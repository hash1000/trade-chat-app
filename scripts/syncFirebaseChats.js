#!/usr/bin/env node
"use strict";

// Incremental Firestore -> MySQL sync, for use after
// scripts/migrateFirebaseChats.js has already run once. Same source
// collections ("group" + "chat", project tradechat-qrm) and same message
// scope (only message/image/video/file) — see the header of
// migrateFirebaseChats.js for why.
//
// Unlike that script, "service_group" docs ARE synced here, mapped onto
// this app's own service chats:
//   - one service                       -> type "service_group", one
//     chat_services row (serviceId + teamId), like createServiceChat.
//   - service_order_id / several services -> type "service_order_group",
//     serviceOrderId set, one chat_services row per service with teamId
//     null, like createOrGetOrderChat.
//   customerId, status, is_paid and the request subject/description come
//   from the doc's nested `service` object. Services/teams/orders that don't
//   exist in the target DB are dropped (counted in the summary), and an
//   order id that another chat already owns is not set again.
//
// What it does, per Firestore doc:
//   - Not in MySQL yet (no row with that legacyId) -> created, exactly like
//     the original migration. This also picks up docs the first run skipped
//     because a user didn't exist yet and now does.
//   - Already in MySQL -> updated to match Firestore:
//       chats:    group name/images/admin/settings overwritten from Firestore
//                 (service chats: also customerId/serviceOrderId when known).
//       services: missing chat_services rows are added; status/isPaid/
//                 request subject+description overwritten. Never removed.
//       members:  members missing in MySQL are added; isFavourite/isArchived/
//                 isDeleteAll/unreadCount/isMention overwritten from
//                 Firestore; the Firestore admin is made isAdmin (nobody is
//                 demoted). Members present in MySQL but no longer in
//                 Firestore are only reported, unless --remove-members.
//                 MySQL-only state (isMuted, isBlocked, lastReadAt,
//                 lockSettings) is never touched.
//       messages: text/media/thumbnail/hashtags/isForward overwritten from
//                 Firestore (text change also sets isEdit) — unless the
//                 MySQL row was modified after Firestore's updated_at,
//                 i.e. it was edited through this app; then it's kept and
//                 counted as messagesKeptAppEdit.
//                 Missing reads / delete-for-all / mentions are added.
//   - Chats that got new or changed Firestore messages get lastMessage /
//     lastMessageAt refreshed, but only when their newest message is itself
//     a Firestore one (otherwise the app already owns that preview).
//
// Never deletes messages: a doc removed from Firestore stays in MySQL.
//
// Usage:
//   node scripts/syncFirebaseChats.js                    # dry run, full report, writes nothing
//   node scripts/syncFirebaseChats.js --commit           # actually writes
//   node scripts/syncFirebaseChats.js --commit --limit=20     # only the first 20 "group" docs (all messages are still scanned)
//   node scripts/syncFirebaseChats.js --no-update        # only create missing chats/messages, never touch existing rows
//   node scripts/syncFirebaseChats.js --remove-members   # also remove MySQL members that are gone from the Firestore chat
//   node scripts/syncFirebaseChats.js --verbose          # log every individual skip/change, not just tallies
//   node scripts/syncFirebaseChats.js --since=2026-11-01 # only messages created/edited since then
//
// --since (any date Date.parse accepts, e.g. 2026-11-01 or 2026-11-01T06:00:00Z)
// limits the message phase to "chat" docs whose created_at or updated_at is
// on/after that time — a few reads instead of the whole collection (~15k),
// which matters on the Spark plan's 50k reads/day shared with the live app.
// Groups are still read in full (~900 reads): membership/settings changes
// carry no timestamp. Changes that don't touch updated_at (e.g. a message
// being seen) are not picked up — run once without --since to catch those.
//
// Same env requirements as migrateFirebaseChats.js: MYSQL_* must point at
// the database holding the real users, and the Firebase service account at
// config/firebase-service-account.json (or FIREBASE_SERVICE_ACCOUNT_PATH).
//
// Safe to re-run any number of times: a second run right after the first
// finds nothing to create and nothing to change.

// Node v26 removed Buffer.SlowBuffer — see migrateFirebaseChats.js.
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
  Service,
  Team,
  Order,
  ChatService: ChatServiceLink, // the chat_services model, not services/ChatService.js
} = require("../models");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const VERBOSE = args.includes("--verbose");
const NO_UPDATE = args.includes("--no-update");
const REMOVE_MEMBERS = args.includes("--remove-members");
const limitArg = args.find((a) => a.startsWith("--limit="));
const GROUP_LIMIT = limitArg ? Number(limitArg.split("=")[1]) : null;
const sinceArg = args.find((a) => a.startsWith("--since="));
const SINCE_MS = sinceArg ? Date.parse(sinceArg.slice("--since=".length)) : null;
if (sinceArg && !Number.isFinite(SINCE_MS)) {
  console.error(`Invalid --since date: ${sinceArg}`);
  process.exit(1);
}

const CHAT_DOC_TYPES = new Set(["chat", "group", "service_group"]);
const MESSAGE_TYPE_MAP = { message: "text", image: "image", video: "video", file: "file" };
const GROUP_PAGE_SIZE = 500;
const MESSAGE_PAGE_SIZE = 1000;
// MySQL DATETIME(0) rounds milliseconds, so a stored updatedAt can sit up to
// half a second after the Firestore updated_at it was copied from.
const TIMESTAMP_TOLERANCE_MS = 1000;

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
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  if (v.length === 1 && v[0] === "[]") return []; // observed double-encoded-JSON bug in some old docs
  return v.filter((x) => typeof x === "string");
}

// Firestore stores service_ids/team_ids either as a real array or as a
// JSON string like "[7,8]".
function parseIdList(v) {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(v) ? v.filter((id) => Number.isInteger(id) && id > 0) : [];
}

function truncate(v, max) {
  v = emptyToNull(v);
  return typeof v === "string" ? v.slice(0, max) : null;
}

// Booleans can come back from MySQL as 0/1, so compare them loosely.
function sameValue(current, wanted) {
  if (typeof wanted === "boolean") return !!current === wanted;
  return (current ?? null) === (wanted ?? null);
}

// Returns only the keys of `wanted` that differ from the model instance.
function diff(instance, wanted) {
  const changes = {};
  for (const [key, value] of Object.entries(wanted)) {
    if (!sameValue(instance.get(key), value)) changes[key] = value;
  }
  return changes;
}

// Mirrors MessageService.previewText — see migrateFirebaseChats.js.
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

// paginate() for "docs where `field` >= sinceMs" (field holds epoch ms).
async function paginateSince(collection, field, sinceMs, pageSize, onPage) {
  let cursor = null;
  for (;;) {
    let q = collection.where(field, ">=", sinceMs).orderBy(field).limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) return;
    await onPage(snap.docs);
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) return;
  }
}

function chatFieldsFromDoc(data, adminId) {
  return {
    groupName: emptyToNull(data.group_name),
    groupImage: emptyToNull(data.group_image),
    groupOnlineImage: emptyToNull(data.group_online_image),
    adminId,
    allowMembersToViewProfile: !!data.allowMembersToViewProfile,
    allowMembersToAddOthers: !!data.allowOthersToAddMembersOrNot,
    enableAIAnswer: !!data.enableAIAnswer,
    simpleModeOn: !!data.simpleModeOn,
  };
}

// Per-user state Firestore keeps on the "group" doc, as a userId -> fields lookup.
function memberStateFromDoc(data) {
  const favSet = new Set(Array.isArray(data.isFav) ? data.isFav : []);
  const archiveSet = new Set(Array.isArray(data.archive) ? data.archive : []);
  const deleteAllByUser = new Map(
    (Array.isArray(data.isAllDeleteMainChat) ? data.isAllDeleteMainChat : []).map((e) => [e.userId, !!e.isDeleteAll])
  );
  const counterByUser = new Map(
    (Array.isArray(data.counterMessageNo) ? data.counterMessageNo : []).map((e) => [e.userId, e])
  );
  return (userId) => ({
    unreadCount: counterByUser.get(userId)?.counter || 0,
    isMention: !!counterByUser.get(userId)?.isMention,
    isFavourite: favSet.has(userId),
    isArchived: archiveSet.has(userId),
    isDeleteAll: !!deleteAllByUser.get(userId),
  });
}

async function run() {
  const firestore = initFirestore();
  const tally = {
    groupsScanned: 0,
    chatsCreated: 0,
    chatsUpdated: 0,
    chatsUnchanged: 0,
    chatsSkippedByType: {},
    chatsSkippedNoValidMembers: 0,
    membersCreated: 0,
    membersUpdated: 0,
    membersRemoved: 0,
    membersOnlyInMysql: 0,
    membersDropped: 0,
    serviceLinksCreated: 0,
    serviceLinksUpdated: 0,
    serviceLinksDropped: 0,
    serviceOrderIdsDropped: 0,
    messagesScanned: 0,
    messagesCreated: 0,
    messagesUpdated: 0,
    messagesUnchanged: 0,
    messagesKeptAppEdit: 0,
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
  if (NO_UPDATE) console.log("--no-update: existing chats/messages are left as they are");
  if (REMOVE_MEMBERS) console.log("--remove-members: members gone from Firestore are removed from MySQL");

  const knownUserIds = new Set((await User.findAll({ attributes: ["id"] })).map((u) => u.id));
  console.log(`Known users in target DB: ${knownUserIds.size}`);
  const knownServiceIds = new Set((await Service.findAll({ attributes: ["id"] })).map((s) => s.id));
  const knownTeamIds = new Set((await Team.findAll({ attributes: ["id"] })).map((tm) => tm.id));

  // A Firestore "service_group" doc -> how this app represents it, or null
  // for plain chats/groups. `ownChatId` is the already-migrated chat (if
  // any), so it doesn't count as "another chat already owns this order".
  async function serviceInfoFromDoc(docId, data, ownChatId) {
    if (data.type !== "service_group") return null;
    const s = data.service && typeof data.service === "object" ? data.service : {};

    const serviceIds = [...new Set(parseIdList(s.service_ids))];
    if (!serviceIds.length && Number.isInteger(s.service_id)) serviceIds.push(s.service_id);
    const isOrderChat = Number.isInteger(s.service_order_id) || serviceIds.length > 1;
    const knownIds = serviceIds.filter((id) => knownServiceIds.has(id));
    tally.serviceLinksDropped += serviceIds.length - knownIds.length;
    if (VERBOSE && knownIds.length < serviceIds.length) {
      console.log(`  group ${docId}: unknown service(s) ${serviceIds.filter((id) => !knownServiceIds.has(id)).join(",")}`);
    }

    let serviceOrderId = null;
    if (Number.isInteger(s.service_order_id)) {
      const [order, claimedBy] = await Promise.all([
        Order.findByPk(s.service_order_id, { attributes: ["id"] }),
        Chat.findOne({
          where: { serviceOrderId: s.service_order_id, ...(ownChatId ? { id: { [Op.ne]: ownChatId } } : {}) },
          attributes: ["id"],
        }),
      ]);
      if (order && !claimedBy) {
        serviceOrderId = s.service_order_id;
      } else {
        tally.serviceOrderIdsDropped++;
        if (VERBOSE) {
          console.log(
            `  group ${docId}: service_order_id ${s.service_order_id} not set — ` +
              (order ? `already owned by chat ${claimedBy.id}` : "order not found")
          );
        }
      }
    }

    // Only fields we actually know — so an update never nulls out what's there.
    const chatFields = {};
    if (knownUserIds.has(s.customer_id)) chatFields.customerId = s.customer_id;
    if (serviceOrderId) chatFields.serviceOrderId = serviceOrderId;

    const teamId = !isOrderChat && knownTeamIds.has(s.team_id) ? s.team_id : null;
    return {
      chatType: isOrderChat ? "service_order_group" : "service_group",
      chatFields,
      links: knownIds.map((serviceId) => ({
        serviceId,
        teamId,
        status: Number.isInteger(s.status) ? s.status : 1,
        isPaid: !!s.is_paid,
        requestSubject: truncate(s.user_service_subject, 255),
        requestDesc: emptyToNull(s.user_service_desc),
      })),
    };
  }

  // legacyId -> chat id, for every chat any run has migrated so far.
  const groupIdToChatId = new Map();
  (await Chat.findAll({ where: { legacyId: { [Op.ne]: null } }, attributes: ["id", "legacyId"] })).forEach((c) =>
    groupIdToChatId.set(c.legacyId, c.id)
  );
  console.log(`Chats already migrated: ${groupIdToChatId.size}`);

  // Chats whose lastMessage may need refreshing after phase 2.
  const touchedChatIds = new Set();

  // ---- Phase 1: chats + members, from the "group" collection ----
  let fakeChatId = 0; // dry-run only, so phase 2 can still report accurate would-be counts
  let groupsProcessed = 0;
  await paginate(firestore.collection("group"), GROUP_PAGE_SIZE, async (allDocs) => {
    const docs = GROUP_LIMIT ? allDocs.slice(0, Math.max(GROUP_LIMIT - groupsProcessed, 0)) : allDocs;
    groupsProcessed += docs.length;
    if (docs.length === 0) return;

    const existingChats = await Chat.findAll({ where: { legacyId: { [Op.in]: docs.map((d) => d.id) } } });
    const chatByLegacy = new Map(existingChats.map((c) => [c.legacyId, c]));
    const membersByChat = new Map();
    const linksByChat = new Map();
    if (existingChats.length) {
      const where = { chatId: { [Op.in]: existingChats.map((c) => c.id) } };
      const [members, links] = await Promise.all([ChatMember.findAll({ where }), ChatServiceLink.findAll({ where })]);
      for (const m of members) {
        if (!membersByChat.has(m.chatId)) membersByChat.set(m.chatId, []);
        membersByChat.get(m.chatId).push(m);
      }
      for (const l of links) {
        if (!linksByChat.has(l.chatId)) linksByChat.set(l.chatId, []);
        linksByChat.get(l.chatId).push(l);
      }
    }

    for (const doc of docs) {
      tally.groupsScanned++;
      const data = doc.data();

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
      const memberState = memberStateFromDoc(data);
      const existingChat = chatByLegacy.get(doc.id);

      // -- new chat: create it the same way migrateFirebaseChats.js does --
      if (!existingChat) {
        const adminId = validMemberIds.includes(data.group_admin_id) ? data.group_admin_id : validMemberIds[0];
        const createdAt = data.created_at ? new Date(data.created_at) : new Date();
        const service = await serviceInfoFromDoc(doc.id, data, null);
        let newChatId;
        if (COMMIT) {
          newChatId = await db.transaction(async (t) => {
            const chat = await Chat.create(
              {
                type: service ? service.chatType : data.type,
                ...chatFieldsFromDoc(data, adminId),
                ...(service ? service.chatFields : {}),
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
                ...memberState(userId),
                createdAt,
                updatedAt: createdAt,
              })),
              { transaction: t }
            );
            if (service && service.links.length) {
              await ChatServiceLink.bulkCreate(
                service.links.map((l) => ({ chatId: chat.id, ...l, createdAt, updatedAt: createdAt })),
                { transaction: t }
              );
            }
            return chat.id;
          });
        } else {
          newChatId = --fakeChatId;
        }
        if (VERBOSE) {
          console.log(
            `  create ${service ? service.chatType : data.type} from group ${doc.id} (${validMemberIds.length} members` +
              (service ? `, services ${service.links.map((l) => l.serviceId).join(",") || "none"}` : "") +
              ")"
          );
        }
        groupIdToChatId.set(doc.id, newChatId);
        touchedChatIds.add(newChatId);
        tally.chatsCreated++;
        tally.membersCreated += validMemberIds.length;
        if (service) tally.serviceLinksCreated += service.links.length;
        continue;
      }

      // -- existing chat: bring it in line with Firestore --
      if (NO_UPDATE) {
        tally.chatsUnchanged++;
        continue;
      }

      // Firestore's admin wins when it's a valid member; otherwise keep ours if still valid.
      const adminId = validMemberIds.includes(data.group_admin_id)
        ? data.group_admin_id
        : validMemberIds.includes(existingChat.adminId)
          ? existingChat.adminId
          : validMemberIds[0];
      const service = await serviceInfoFromDoc(doc.id, data, existingChat.id);
      const chatChanges = diff(existingChat, {
        ...chatFieldsFromDoc(data, adminId),
        ...(service ? service.chatFields : {}),
      });

      const linksToAdd = [];
      const linkUpdates = [];
      if (service) {
        const linkByService = new Map((linksByChat.get(existingChat.id) || []).map((l) => [l.serviceId, l]));
        for (const link of service.links) {
          const current = linkByService.get(link.serviceId);
          if (!current) {
            linksToAdd.push({ chatId: existingChat.id, ...link });
            continue;
          }
          const { serviceId, teamId, ...wanted } = link;
          if (teamId) wanted.teamId = teamId; // never clear a team this app set
          const changes = diff(current, wanted);
          if (Object.keys(changes).length) linkUpdates.push({ id: current.id, serviceId, changes });
        }
      }

      const currentMembers = membersByChat.get(existingChat.id) || [];
      const currentByUser = new Map(currentMembers.map((m) => [m.userId, m]));
      const validSet = new Set(validMemberIds);

      const membersToAdd = validMemberIds
        .filter((userId) => !currentByUser.has(userId))
        .map((userId) => ({ chatId: existingChat.id, userId, isAdmin: userId === adminId, ...memberState(userId) }));

      const memberUpdates = [];
      for (const userId of validMemberIds) {
        const member = currentByUser.get(userId);
        if (!member) continue;
        const wanted = memberState(userId);
        if (userId === adminId) wanted.isAdmin = true; // promote only — never demote other admins
        const changes = diff(member, wanted);
        if (Object.keys(changes).length) memberUpdates.push({ id: member.id, userId, changes });
      }

      const membersGone = currentMembers.filter((m) => !validSet.has(m.userId));

      if (
        !Object.keys(chatChanges).length &&
        !membersToAdd.length &&
        !memberUpdates.length &&
        !linksToAdd.length &&
        !linkUpdates.length &&
        !(REMOVE_MEMBERS && membersGone.length)
      ) {
        tally.chatsUnchanged++;
        tally.membersOnlyInMysql += membersGone.length;
        continue;
      }

      if (VERBOSE) {
        console.log(
          `  update chat ${existingChat.id} (group ${doc.id}):` +
            (Object.keys(chatChanges).length ? ` fields=${Object.keys(chatChanges).join(",")}` : "") +
            (membersToAdd.length ? ` +members=${membersToAdd.map((m) => m.userId).join(",")}` : "") +
            (memberUpdates.length ? ` ~members=${memberUpdates.map((m) => m.userId).join(",")}` : "") +
            (membersGone.length ? ` ${REMOVE_MEMBERS ? "-" : "?"}members=${membersGone.map((m) => m.userId).join(",")}` : "") +
            (linksToAdd.length ? ` +services=${linksToAdd.map((l) => l.serviceId).join(",")}` : "") +
            (linkUpdates.length ? ` ~services=${linkUpdates.map((l) => l.serviceId).join(",")}` : "")
        );
      }

      if (COMMIT) {
        await db.transaction(async (t) => {
          if (Object.keys(chatChanges).length) {
            await Chat.update(chatChanges, { where: { id: existingChat.id }, transaction: t });
          }
          if (membersToAdd.length) {
            await ChatMember.bulkCreate(membersToAdd, { transaction: t, ignoreDuplicates: true });
          }
          for (const u of memberUpdates) {
            await ChatMember.update(u.changes, { where: { id: u.id }, transaction: t });
          }
          if (REMOVE_MEMBERS && membersGone.length) {
            await ChatMember.destroy({ where: { id: { [Op.in]: membersGone.map((m) => m.id) } }, transaction: t });
          }
          if (linksToAdd.length) {
            await ChatServiceLink.bulkCreate(linksToAdd, { transaction: t, ignoreDuplicates: true });
          }
          for (const u of linkUpdates) {
            await ChatServiceLink.update(u.changes, { where: { id: u.id }, transaction: t });
          }
        });
      }

      tally.chatsUpdated++;
      tally.serviceLinksCreated += linksToAdd.length;
      tally.serviceLinksUpdated += linkUpdates.length;
      tally.membersCreated += membersToAdd.length;
      tally.membersUpdated += memberUpdates.length;
      if (REMOVE_MEMBERS) tally.membersRemoved += membersGone.length;
      else tally.membersOnlyInMysql += membersGone.length;
    }
  });

  // ---- Phase 2: messages (+ reads/deletes/mentions), from the "chat" collection ----

  // Firestore message doc -> { row, extras } ready to insert/compare, or
  // { skip } naming the tally counter to bump.
  function parseMessage(doc, data) {
    const messageType = MESSAGE_TYPE_MAP[data.message_type];
    if (!messageType) return { skip: "byType", type: data.message_type || "(none)" };
    const chatId = groupIdToChatId.get(data.group_id);
    if (!chatId) return { skip: "messagesSkippedUnmigratedChat", why: `chat ${data.group_id} was not migrated` };
    const senderId = data.message_sender_id;
    if (!knownUserIds.has(senderId)) return { skip: "messagesSkippedUnknownSender", why: `unknown sender ${senderId}` };

    let messageText = null;
    let mediaUrl = null;
    let thumbnailUrl = null;
    if (messageType === "text") {
      messageText = typeof data.message === "string" && data.message.trim() ? data.message : null;
      if (!messageText) return { skip: "messagesSkippedEmptyText" };
    } else {
      mediaUrl = pickUrl(data.mediaUrl);
      if (!mediaUrl) return { skip: "messagesSkippedBadMedia", why: `mediaUrl not a real URL (${data.mediaUrl})` };
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

    return {
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
    };
  }

  const pairKey = (messageId, userId) => `${messageId}:${userId}`;

  // Adds the reads/deletes/mentions a message should have but doesn't yet.
  function collectExtras(messageId, parsed, have, out) {
    for (const userId of parsed.extras.seenBy) {
      if (!have.reads.has(pairKey(messageId, userId))) out.reads.push({ messageId, userId, seenAt: parsed.row.createdAt });
    }
    for (const userId of parsed.extras.deletedBy) {
      if (!have.deletes.has(pairKey(messageId, userId))) out.deletes.push({ messageId, userId, isDeleteAll: true });
    }
    for (const userId of parsed.extras.mentions) {
      if (!have.mentions.has(pairKey(messageId, userId))) out.mentions.push({ messageId, userId });
    }
  }

  const processMessagePage = async (docs) => {
    const existing = await Message.findAll({
      where: { legacyId: { [Op.in]: docs.map((d) => d.id) } },
      attributes: ["id", "legacyId", "chatId", "message", "mediaUrl", "thumbnailUrl", "hashtags", "isForward", "updatedAt"],
    });
    const existingByLegacy = new Map(existing.map((m) => [m.legacyId, m]));

    const have = { reads: new Set(), deletes: new Set(), mentions: new Set() };
    if (existing.length && !NO_UPDATE) {
      const where = { messageId: { [Op.in]: existing.map((m) => m.id) } };
      const attributes = ["messageId", "userId"];
      const [reads, deletes, mentions] = await Promise.all([
        MessageRead.findAll({ where, attributes }),
        MessageDelete.findAll({ where, attributes }),
        MessageMention.findAll({ where, attributes }),
      ]);
      reads.forEach((r) => have.reads.add(pairKey(r.messageId, r.userId)));
      deletes.forEach((r) => have.deletes.add(pairKey(r.messageId, r.userId)));
      mentions.forEach((r) => have.mentions.add(pairKey(r.messageId, r.userId)));
    }

    const inserts = [];
    const updates = [];
    const extras = { reads: [], deletes: [], mentions: [] };

    for (const doc of docs) {
      tally.messagesScanned++;
      const parsed = parseMessage(doc, doc.data());
      if (parsed.skip) {
        if (parsed.skip === "byType") bump(tally.messagesSkippedByType, parsed.type);
        else tally[parsed.skip]++;
        if (VERBOSE && parsed.why) console.log(`  skip message ${doc.id}: ${parsed.why}`);
        continue;
      }

      const current = existingByLegacy.get(doc.id);
      if (!current) {
        inserts.push(parsed);
        touchedChatIds.add(parsed.row.chatId);
        continue;
      }
      if (NO_UPDATE) {
        tally.messagesUnchanged++;
        continue;
      }

      const { row } = parsed;
      const changes = diff(current, {
        message: row.message,
        mediaUrl: row.mediaUrl,
        thumbnailUrl: row.thumbnailUrl,
        isForward: row.isForward,
      });
      if (JSON.stringify(normalizeHashtags(current.hashtags)) !== JSON.stringify(row.hashtags)) {
        changes.hashtags = row.hashtags;
      }
      if (Object.keys(changes).length) {
        if (current.updatedAt.getTime() > row.updatedAt.getTime() + TIMESTAMP_TOLERANCE_MS) {
          tally.messagesKeptAppEdit++;
          if (VERBOSE) console.log(`  keep message ${current.id}: edited in this app after Firestore's last update`);
        } else {
          if ("message" in changes) changes.isEdit = true;
          updates.push({ id: current.id, changes });
          touchedChatIds.add(current.chatId);
          if (VERBOSE) console.log(`  update message ${current.id} (doc ${doc.id}): ${Object.keys(changes).join(",")}`);
        }
      } else {
        tally.messagesUnchanged++;
      }
      collectExtras(current.id, parsed, have, extras);
    }

    if (COMMIT) {
      await db.transaction(async (t) => {
        if (inserts.length) {
          await Message.bulkCreate(
            inserts.map((p) => p.row),
            { transaction: t }
          );
          const created = await Message.findAll({
            where: { legacyId: { [Op.in]: inserts.map((p) => p.row.legacyId) } },
            attributes: ["id", "legacyId"],
            transaction: t,
          });
          const idByLegacy = new Map(created.map((m) => [m.legacyId, m.id]));
          const none = { reads: new Set(), deletes: new Set(), mentions: new Set() };
          for (const p of inserts) {
            const messageId = idByLegacy.get(p.row.legacyId);
            if (messageId) collectExtras(messageId, p, none, extras);
          }
        }
        for (const u of updates) {
          await Message.update(u.changes, { where: { id: u.id }, transaction: t });
        }
        if (extras.reads.length) await MessageRead.bulkCreate(extras.reads, { transaction: t, ignoreDuplicates: true });
        if (extras.deletes.length) await MessageDelete.bulkCreate(extras.deletes, { transaction: t, ignoreDuplicates: true });
        if (extras.mentions.length) await MessageMention.bulkCreate(extras.mentions, { transaction: t, ignoreDuplicates: true });
      });
    } else {
      // Dry run: count the extras new messages would get, without ids.
      for (const p of inserts) {
        extras.reads.push(...p.extras.seenBy);
        extras.deletes.push(...p.extras.deletedBy);
        extras.mentions.push(...p.extras.mentions);
      }
    }

    tally.messagesCreated += inserts.length;
    tally.messagesUpdated += updates.length;
    tally.readsCreated += extras.reads.length;
    tally.deletesCreated += extras.deletes.length;
    tally.mentionsCreated += extras.mentions.length;
  };

  if (SINCE_MS === null) {
    await paginate(firestore.collection("chat"), MESSAGE_PAGE_SIZE, processMessagePage);
  } else {
    // Created-since and edited-since, each doc processed once.
    console.log(`Messages: only those created or edited since ${new Date(SINCE_MS).toISOString()}`);
    const seen = new Set();
    const onlyNew = async (docs) => {
      const fresh = docs.filter((d) => !seen.has(d.id));
      fresh.forEach((d) => seen.add(d.id));
      if (fresh.length) await processMessagePage(fresh);
    };
    for (const field of ["created_at", "updated_at"]) {
      await paginateSince(firestore.collection("chat"), field, SINCE_MS, MESSAGE_PAGE_SIZE, onlyNew);
    }
    tally.messageDocsRead = seen.size;
  }

  // ---- Phase 3: refresh chat.lastMessage / lastMessageAt where Firestore data changed ----
  if (COMMIT) {
    for (const chatId of touchedChatIds) {
      const last = await Message.findOne({ where: { chatId }, order: [["createdAt", "DESC"]] });
      if (!last || !last.legacyId) continue; // newest message came from this app, which keeps its own preview
      await Chat.update(
        { lastMessage: previewText(last), lastMessageAt: last.createdAt },
        { where: { id: chatId } }
      );
      tally.chatsBackfilledLastMessage++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(tally, null, 2));
  if (tally.membersOnlyInMysql && !REMOVE_MEMBERS) {
    console.log(`\n${tally.membersOnlyInMysql} member(s) are in MySQL but no longer in the Firestore chat — re-run with --remove-members to remove them.`);
  }
  if (!COMMIT) console.log("\nDRY RUN — nothing was written. Re-run with --commit to apply.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SYNC FAILED:", err);
    process.exit(1);
  });
