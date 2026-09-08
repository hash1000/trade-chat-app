#!/usr/bin/env node
"use strict";

// One-time migration: Firestore ("group" + "chat" collections, project
// tradechat-qrm) -> this app's MySQL tables (chats/chat_members/messages/
// message_reads/message_deletes/message_mentions).
//
// Scope (per product decision, not everything Firestore holds):
//   - "group" docs: only type "chat" (1:1) and "group" (multi-member).
//     type "service_group" is a legacy concept superseded by this app's own
//     service_group/service_order_group chats — not migrated.
//   - "chat" (message) docs: only message_type "message"/"image"/"video"/
//     "file". Everything else (system, sendPayment, sendPayRequest,
//     balanceSheet, sendContact, address, bankCard, shortList, document,
//     and docs with no message_type at all) is skipped. "document" is
//     skipped deliberately even though it's media-shaped: its mediaUrl is a
//     local device filesystem path (/data/user/0/...), never an uploaded
//     URL, so there is nothing reachable to link to.
//
// Usage:
//   node scripts/migrateFirebaseChats.js                 # dry run, full report, writes nothing
//   node scripts/migrateFirebaseChats.js --commit         # actually writes
//   node scripts/migrateFirebaseChats.js --commit --limit=20   # only the first 20 "group" docs
//                                                                (+ whatever of their messages resolve) — smoke test
//   node scripts/migrateFirebaseChats.js --verbose         # log every individual skip, not just tallies
//
// MUST be run with MYSQL_* env vars pointed at the database you actually
// want this data in (production or a production data copy) — user ids in
// Firestore are matched against whatever `users` table this process
// connects to, via config/database.js's normal env-based config. Run
// against a database that doesn't have the real users and every message/
// membership will be (correctly) skipped as "unknown user".
//
// Idempotent / resumable: every migrated chat and message is tagged with
// legacyId (the Firestore doc id). A doc whose legacyId already exists is
// skipped, so interrupting this script (Ctrl+C, crash, connection drop) and
// re-running it later just continues — it never re-creates or duplicates
// what already landed.
//
// Reversible: `DELETE FROM messages WHERE legacyId IS NOT NULL` then
// `DELETE FROM chat_members WHERE chatId IN (SELECT id FROM chats WHERE
// legacyId IS NOT NULL)` then `DELETE FROM chats WHERE legacyId IS NOT
// NULL` undoes a run completely (message_reads/message_deletes/
// message_mentions cascade-free — clean those up by messageId if you go
// this route, or just accept them as orphaned-but-harmless after the
// messages delete, since nothing joins back to a missing messageId).

// Node v26 removed Buffer.SlowBuffer, which breaks jsonwebtoken's
// transitive buffer-equal-constant-time require — and firebase-admin's
// google-auth-library dependency pulls that in for JWT signing. No-op on
// any Node version that still has SlowBuffer (i.e. production, if it runs
// an older Node).
if (!require("buffer").SlowBuffer) {
  require("buffer").SlowBuffer = function SlowBuffer(length) {
    return Buffer.alloc(length);
  };
}

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
const { Op } = require("sequelize");
const {
  db,
  User,
  Chat,
  ChatMember,
  Message,
  MessageRead,
  MessageDelete,
  MessageMention,
} = require("../models");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const VERBOSE = args.includes("--verbose");
const limitArg = args.find((a) => a.startsWith("--limit="));
const GROUP_LIMIT = limitArg ? Number(limitArg.split("=")[1]) : null;

const CHAT_DOC_TYPES = new Set(["chat", "group"]);
const MESSAGE_TYPE_MAP = { message: "text", image: "image", video: "video", file: "file" };
const GROUP_PAGE_SIZE = 500;
const MESSAGE_PAGE_SIZE = 1000;
const MESSAGE_BATCH_SIZE = 200;

function initFirestore() {
  const saPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "..", "config", "firebase-service-account.json")
  );
  if (!fs.existsSync(saPath)) {
    throw new Error(`No Firebase service account found at ${saPath}`);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  }
  return admin.firestore();
}

function emptyToNull(v) {
  return v === "" || v === undefined ? null : v;
}

function looksLikeUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function pickUrl(...candidates) {
  for (const c of candidates) {
    if (looksLikeUrl(c)) return c;
  }
  return null;
}

function normalizeHashtags(v) {
  if (!Array.isArray(v)) return [];
  if (v.length === 1 && v[0] === "[]") return []; // observed double-encoded-JSON bug in some old docs
  return v.filter((x) => typeof x === "string");
}

// Mirrors MessageService.previewText — kept as a standalone copy here
// rather than instantiating that service (which wants repository/
// notification dependencies this bulk script has no use for).
const PREVIEW_LABELS = { image: "📷 Photo", video: "🎥 Video", file: "📎 Attachment" };
function previewText(message) {
  if (message.message) return message.message;
  return PREVIEW_LABELS[message.messageType] || "";
}

async function paginate(collection, pageSize, onPage) {
  let cursor = null;
  for (;;) {
    let q = collection.orderBy("__name__").limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) return;
    await onPage(snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) return;
  }
}

async function run() {
  const firestore = initFirestore();
  const tally = {
    groupsScanned: 0,
    chatsCreated: 0,
    chatsAlreadyMigrated: 0,
    chatsSkippedByType: {},
    chatsSkippedNoValidMembers: 0,
    membersCreated: 0,
    membersDropped: 0,
    messagesScanned: 0,
    messagesCreated: 0,
    messagesAlreadyMigrated: 0,
    messagesSkippedByType: {},
    messagesSkippedUnmigratedChat: 0,
    messagesSkippedUnknownSender: 0,
    messagesSkippedEmptyText: 0,
    messagesSkippedBadMedia: 0,
    readsCreated: 0,
    deletesCreated: 0,
    mentionsCreated: 0,
    chatsBackfilledLastMessage: 0,
  };
  const bump = (obj, key) => (obj[key] = (obj[key] || 0) + 1);

  console.log(COMMIT ? "=== COMMIT MODE — writing to the database ===" : "=== DRY RUN — no data will be written (pass --commit to apply) ===");
  if (GROUP_LIMIT) console.log(`--limit=${GROUP_LIMIT}: only the first ${GROUP_LIMIT} "group" docs`);

  const knownUserIds = new Set((await User.findAll({ attributes: ["id"] })).map((u) => u.id));
  console.log(`Known users in target DB: ${knownUserIds.size}`);

  // legacyId -> new chat id. Seeded from whatever a prior run already
  // migrated so this run (and message-linking below) picks up cleanly.
  const groupIdToChatId = new Map();
  (await Chat.findAll({ where: { legacyId: { [Op.ne]: null } }, attributes: ["id", "legacyId"] })).forEach((c) =>
    groupIdToChatId.set(c.legacyId, c.id)
  );
  const existingMessageLegacyIds = new Set(
    (await Message.findAll({ where: { legacyId: { [Op.ne]: null } }, attributes: ["legacyId"] })).map(
      (m) => m.legacyId
    )
  );

  // ---- Phase 1: chats + members, from the "group" collection ----
  let fakeChatId = 0; // dry-run only, so phase 2 can still report accurate would-be counts
  let groupsProcessed = 0;
  await paginate(firestore.collection("group"), GROUP_PAGE_SIZE, async (docs) => {
    for (const doc of docs) {
      if (GROUP_LIMIT && groupsProcessed >= GROUP_LIMIT) return;
      groupsProcessed++;
      tally.groupsScanned++;
      const data = doc.data();

      if (groupIdToChatId.has(doc.id)) {
        tally.chatsAlreadyMigrated++;
        continue;
      }
      if (!CHAT_DOC_TYPES.has(data.type)) {
        bump(tally.chatsSkippedByType, data.type || "(none)");
        continue;
      }

      const rawMemberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
      const validMemberIds = [...new Set(rawMemberIds)].filter(
        (id) => Number.isInteger(id) && id > 0 && knownUserIds.has(id)
      );
      tally.membersDropped += rawMemberIds.length - validMemberIds.length;
      if (validMemberIds.length === 0) {
        tally.chatsSkippedNoValidMembers++;
        if (VERBOSE) console.log(`  skip group ${doc.id}: no valid members (had ${rawMemberIds.join(",")})`);
        continue;
      }

      let adminId = validMemberIds.includes(data.group_admin_id) ? data.group_admin_id : validMemberIds[0];
      const createdAt = data.created_at ? new Date(data.created_at) : new Date();
      const favSet = new Set(Array.isArray(data.isFav) ? data.isFav : []);
      const archiveSet = new Set(Array.isArray(data.archive) ? data.archive : []);
      const deleteAllByUser = new Map(
        (Array.isArray(data.isAllDeleteMainChat) ? data.isAllDeleteMainChat : []).map((e) => [e.userId, !!e.isDeleteAll])
      );
      const counterByUser = new Map(
        (Array.isArray(data.counterMessageNo) ? data.counterMessageNo : []).map((e) => [e.userId, e])
      );

      let newChatId;
      if (COMMIT) {
        newChatId = await db.transaction(async (t) => {
          const chat = await Chat.create(
            {
              type: data.type,
              groupName: emptyToNull(data.group_name),
              groupImage: emptyToNull(data.group_image),
              groupOnlineImage: emptyToNull(data.group_online_image),
              adminId,
              allowMembersToViewProfile: !!data.allowMembersToViewProfile,
              allowMembersToAddOthers: !!data.allowOthersToAddMembersOrNot,
              enableAIAnswer: !!data.enableAIAnswer,
              simpleModeOn: !!data.simpleModeOn,
              legacyId: doc.id,
              createdAt,
              updatedAt: createdAt,
            },
            { transaction: t }
          );
          await ChatMember.bulkCreate(
            validMemberIds.map((userId) => ({
              chatId: chat.id,
              userId,
              isAdmin: userId === adminId,
              unreadCount: counterByUser.get(userId)?.counter || 0,
              isMention: !!counterByUser.get(userId)?.isMention,
              isFavourite: favSet.has(userId),
              isArchived: archiveSet.has(userId),
              isDeleteAll: !!deleteAllByUser.get(userId),
              createdAt,
              updatedAt: createdAt,
            })),
            { transaction: t }
          );
          return chat.id;
        });
      } else {
        newChatId = --fakeChatId;
      }

      groupIdToChatId.set(doc.id, newChatId);
      tally.chatsCreated++;
      tally.membersCreated += validMemberIds.length;
    }
  });

  // ---- Phase 2: messages (+ reads/deletes/mentions), from the "chat" collection ----
  let batch = [];
  async function flushBatch() {
    if (batch.length === 0) return;
    const rows = batch;
    batch = [];
    if (!COMMIT) {
      rows.forEach((r) => tally.messagesCreated++);
      return;
    }
    await db.transaction(async (t) => {
      await Message.bulkCreate(
        rows.map((r) => r.row),
        { transaction: t }
      );
      const created = await Message.findAll({
        where: { legacyId: { [Op.in]: rows.map((r) => r.row.legacyId) } },
        attributes: ["id", "legacyId", "createdAt"],
        transaction: t,
      });
      const idByLegacy = new Map(created.map((m) => [m.legacyId, m.id]));

      const reads = [];
      const deletes = [];
      const mentions = [];
      for (const r of rows) {
        const messageId = idByLegacy.get(r.row.legacyId);
        if (!messageId) continue; // shouldn't happen — every row we just inserted has a unique legacyId
        for (const userId of r.extras.seenBy) reads.push({ messageId, userId, seenAt: r.row.createdAt });
        for (const userId of r.extras.deletedBy) deletes.push({ messageId, userId, isDeleteAll: true });
        for (const userId of r.extras.mentions) mentions.push({ messageId, userId });
      }
      if (reads.length) {
        await MessageRead.bulkCreate(reads, { transaction: t, ignoreDuplicates: true });
        tally.readsCreated += reads.length;
      }
      if (deletes.length) {
        await MessageDelete.bulkCreate(deletes, { transaction: t, ignoreDuplicates: true });
        tally.deletesCreated += deletes.length;
      }
      if (mentions.length) {
        await MessageMention.bulkCreate(mentions, { transaction: t, ignoreDuplicates: true });
        tally.mentionsCreated += mentions.length;
      }
      tally.messagesCreated += rows.length;
    });
  }

  await paginate(firestore.collection("chat"), MESSAGE_PAGE_SIZE, async (docs) => {
    for (const doc of docs) {
      tally.messagesScanned++;
      const data = doc.data();

      if (existingMessageLegacyIds.has(doc.id)) {
        tally.messagesAlreadyMigrated++;
        continue;
      }
      const messageType = MESSAGE_TYPE_MAP[data.message_type];
      if (!messageType) {
        bump(tally.messagesSkippedByType, data.message_type || "(none)");
        continue;
      }
      const chatId = groupIdToChatId.get(data.group_id);
      if (!chatId) {
        tally.messagesSkippedUnmigratedChat++;
        if (VERBOSE) console.log(`  skip message ${doc.id}: chat ${data.group_id} was not migrated`);
        continue;
      }
      const senderId = data.message_sender_id;
      if (!knownUserIds.has(senderId)) {
        tally.messagesSkippedUnknownSender++;
        if (VERBOSE) console.log(`  skip message ${doc.id}: unknown sender ${senderId}`);
        continue;
      }

      let messageText = null;
      let mediaUrl = null;
      let thumbnailUrl = null;
      if (messageType === "text") {
        messageText = typeof data.message === "string" && data.message.trim() ? data.message : null;
        if (!messageText) {
          tally.messagesSkippedEmptyText++;
          continue;
        }
      } else {
        mediaUrl = pickUrl(data.mediaUrl);
        if (!mediaUrl) {
          tally.messagesSkippedBadMedia++;
          if (VERBOSE) console.log(`  skip message ${doc.id}: mediaUrl not a real URL (${data.mediaUrl})`);
          continue;
        }
        if (messageType === "image" || messageType === "video") {
          thumbnailUrl = pickUrl(data.thumbnailUrl, data.thumbnail);
        }
      }

      const createdAt = data.created_at ? new Date(data.created_at) : new Date();
      const updatedAt = data.updated_at ? new Date(data.updated_at) : createdAt;

      const seenBy = new Set(
        (Array.isArray(data.seenMessagePersons) ? data.seenMessagePersons : []).filter((id) => knownUserIds.has(id))
      );
      seenBy.add(senderId); // sending counts as having seen it — mirrors MessageRepository.create
      const deletedBy = (Array.isArray(data.deleteMessagePersonsIds) ? data.deleteMessagePersonsIds : [])
        .filter((e) => e.isDeleteAll && knownUserIds.has(e.userId))
        .map((e) => e.userId);
      const mentions = (Array.isArray(data.mention_members) ? data.mention_members : [])
        .map((e) => e.memberId)
        .filter((id) => knownUserIds.has(id));

      batch.push({
        row: {
          chatId,
          senderId,
          messageType,
          message: messageText,
          mediaUrl,
          thumbnailUrl,
          isForward: !!data.isForward,
          isUploading: false,
          uploadingPercentage: 100,
          hashtags: normalizeHashtags(data.hashtags),
          legacyId: doc.id,
          createdAt,
          updatedAt,
        },
        extras: { seenBy: [...seenBy], deletedBy, mentions },
      });
      if (batch.length >= MESSAGE_BATCH_SIZE) await flushBatch();
    }
  });
  await flushBatch();

  // ---- Phase 3: backfill chat.lastMessage / lastMessageAt from real migrated messages ----
  if (COMMIT) {
    for (const chatId of new Set(groupIdToChatId.values())) {
      const last = await Message.findOne({ where: { chatId }, order: [["createdAt", "DESC"]] });
      if (!last) continue;
      await Chat.update(
        { lastMessage: previewText(last), lastMessageAt: last.createdAt },
        { where: { id: chatId } }
      );
      tally.chatsBackfilledLastMessage++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(tally, null, 2));
  if (!COMMIT) console.log("\nDRY RUN — nothing was written. Re-run with --commit to apply.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("MIGRATION FAILED:", err);
    process.exit(1);
  });
