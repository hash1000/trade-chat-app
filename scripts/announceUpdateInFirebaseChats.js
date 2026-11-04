#!/usr/bin/env node
"use strict";

// Posts a "please update the app" message into Firebase chats, for users
// still on an old app build — those builds read chats straight from
// Firestore. Only chats with at least one member on an old build (no JPush
// registration) get it.
//
// The message mirrors the old app's own Firestore message shape (text
// message from sender id 0 "NaskoChina"); the chat's last-message preview
// and every member's unread counter are bumped so it shows in the chat list.
// It carries isUpdateNotice: true, which scripts/syncFirebaseChats.js skips,
// so it never reaches MySQL / the new app.
//
// One notice per chat per version: the doc id is fixed
// (update-notice-<version>-<group id>), so re-running never duplicates.
// Firestore cost (Spark plan: 50k reads / 20k writes per day): about
// 1 read per chat + 2 reads and 2 writes per chat that gets a notice.
//
// Usage:
//   node scripts/announceUpdateInFirebaseChats.js                  # dry run: counts only
//   node scripts/announceUpdateInFirebaseChats.js --group=<groupId> --commit   # one chat only (test)
//   node scripts/announceUpdateInFirebaseChats.js --commit         # all chats with old-build members
//   --version=3.1.2   override the version (default: the version row the app reads)

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
const { User } = require("../models");
const Version = require("../models/version");
const { PLAY_STORE_URL, WEB_APP_URL } = require("../config/appLinks");

const args = process.argv.slice(2);
const arg = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const COMMIT = args.includes("--commit");
const ONLY_GROUP = arg("group") || null;
const PAGE_SIZE = 500;
const SENDER_ID = 0;
const SENDER_NAME = "NaskoChina";

function initFirestore() {
  const saPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "..", "config", "firebase-service-account.json")
  );
  if (!fs.existsSync(saPath)) throw new Error(`No Firebase service account found at ${saPath}`);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  return admin.firestore();
}

function noticeText(version) {
  return (
    `📢 NaskoChina has moved to a new server. Please update the app to version ${version} — ` +
    `older versions can no longer connect.\n\n` +
    `Update on Google Play: ${PLAY_STORE_URL}\n\n` +
    `Or use NaskoChina in your browser: ${WEB_APP_URL}`
  );
}

function noticeDoc(id, group, memberIds, text, now) {
  return {
    chat_id: id,
    id: 0,
    group_id: group.id,
    group_name: group.data().group_name || "",
    message: text,
    message_type: "message",
    message_sender_id: SENDER_ID,
    message_sender_name: SENDER_NAME,
    message_sender_imageUrl: "",
    created_at: now,
    updated_at: now,
    seenMessagePersons: [],
    deleteMessagePersonsIds: memberIds.map((userId) => ({ isDeleteAll: 0, userId })),
    mention_members: [],
    hashtags: [],
    isForward: 0,
    isUploading: 0,
    uploadingPercentage: 0,
    mediaUrl: "",
    thumbnailUrl: "",
    thumbnail: "",
    replyType: "message",
    replyerId: 0,
    replyerName: "",
    message_parent: "",
    message_type_isReply: "",
    paymentStatus: "",
    paymentNote: "",
    contactCardId: null,
    contactCardName: null,
    contactCardImage: null,
    bankCard: null,
    balanceSheet: null,
    order: null,
    shortList: null,
    address: null,
    isUpdateNotice: true,
  };
}

async function readGroups(db) {
  if (ONLY_GROUP) {
    const g = await db.collection("group").doc(ONLY_GROUP).get();
    if (!g.exists) throw new Error(`Group ${ONLY_GROUP} not found in Firestore`);
    return [g];
  }
  const out = [];
  let cursor = null;
  for (;;) {
    let q = db.collection("group").orderBy("__name__").limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    out.push(...snap.docs);
    if (snap.size < PAGE_SIZE) return out;
    cursor = snap.docs[snap.docs.length - 1];
  }
}

async function run() {
  let version = arg("version");
  if (!version) {
    const latest = await Version.findOne({ order: [["createdAt", "DESC"]], attributes: ["version"] });
    version = latest && latest.version;
  }
  if (!version) throw new Error("No version found — pass --version=");

  const oldBuildUserIds = new Set(
    (await User.findAll({ where: { jpushRegistrationId: null }, attributes: ["id"], raw: true })).map((u) => u.id)
  );

  const db = initFirestore();
  const groups = await readGroups(db);
  const targets = groups.filter((g) => {
    const members = Array.isArray(g.data().memberIds) ? g.data().memberIds : [];
    return members.some((id) => oldBuildUserIds.has(Number(id)));
  });
  console.log(
    `Version ${version}: ${groups.length} Firebase chat(s) read, ${targets.length} have a member on an old build.`
  );
  console.log(`Message:\n---\n${noticeText(version)}\n---`);

  if (!COMMIT) {
    console.log(`\nDRY RUN — nothing written. Add --commit to post (about ${targets.length * 2} writes).`);
    return;
  }

  const text = noticeText(version);
  const preview = `📢 Please update NaskoChina to version ${version}`;
  const noticeId = (groupId) => `update-notice-${String(version).replace(/[^0-9A-Za-z._-]/g, "_")}-${groupId}`;
  let posted = 0;
  let alreadyThere = 0;
  let failed = 0;
  for (const g of targets) {
    const noticeRef = db.collection("chat").doc(noticeId(g.id));
    try {
      const wrote = await db.runTransaction(async (t) => {
        const [existing, fresh] = await Promise.all([t.get(noticeRef), t.get(g.ref)]);
        if (existing.exists) return false;
        const data = fresh.data() || {};
        const memberIds = Array.isArray(data.memberIds) ? data.memberIds : [];
        const now = Date.now();
        t.create(noticeRef, noticeDoc(noticeRef.id, fresh, memberIds, text, now));
        const groupUpdate = { group_last_message: preview };
        if (Array.isArray(data.counterMessageNo)) {
          groupUpdate.counterMessageNo = data.counterMessageNo.map((c) =>
            c && c.userId !== SENDER_ID ? { ...c, counter: (Number(c.counter) || 0) + 1 } : c
          );
        }
        t.update(g.ref, groupUpdate);
        return true;
      });
      if (wrote) posted++;
      else alreadyThere++;
    } catch (err) {
      failed++;
      console.log(`  chat ${g.id}: ${err.message}`);
      if (/RESOURCE_EXHAUSTED|quota/i.test(err.message)) {
        console.log("Firestore daily quota reached — stopping. Run again tomorrow; posted chats are skipped.");
        break;
      }
    }
  }
  console.log(`Posted: ${posted}, already had this notice: ${alreadyThere}, failed: ${failed}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exit(1);
  });
