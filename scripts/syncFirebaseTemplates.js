#!/usr/bin/env node
"use strict";

// Firestore "templates" -> MySQL `templates`, same project/service account as
// scripts/syncFirebaseChats.js. Each Firestore doc
//   { admin_id, title, subTitle, order, created_at, template_id }
// becomes one row: userId = admin_id (the backend user id the app stored),
// sequence = order, createdAt = created_at, legacyId = doc id.
//
// Per doc:
//   - Not in MySQL yet -> created (skipped if admin_id isn't an existing user).
//   - Already in MySQL -> title/subTitle/sequence overwritten from Firestore,
//     but only if the row was never changed through this app (updatedAt still
//     equals createdAt — the sync writes both from created_at and updates
//     silently). Edited/reordered rows are kept and counted.
//   - Deleted in this app (soft-deleted row) -> left deleted, never re-created.
//   - Gone from Firestore -> only reported, unless --remove-deleted, which
//     soft-deletes the MySQL row (again only if never changed in this app).
//
// Firestore cost: one read per template doc, nothing else.
//
// Usage:
//   node scripts/syncFirebaseTemplates.js                  # dry run, writes nothing
//   node scripts/syncFirebaseTemplates.js --commit         # actually writes
//   node scripts/syncFirebaseTemplates.js --commit --remove-deleted
//   node scripts/syncFirebaseTemplates.js --verbose        # log every change/skip
//
// Safe to re-run: a second run right after the first changes nothing.

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
const { db, User, Template } = require("../models");

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const VERBOSE = args.includes("--verbose");
const REMOVE_DELETED = args.includes("--remove-deleted");

const PAGE_SIZE = 500;
const TITLE_MAX = 255;
// MySQL DATETIME(0) rounds milliseconds — see syncFirebaseChats.js.
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

function toDate(v) {
  if (v && typeof v.toDate === "function") return v.toDate(); // Firestore Timestamp
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n) : null;
}

function parseDoc(doc) {
  const data = doc.data();
  const userId = Number(data.admin_id);
  let title = typeof data.title === "string" ? data.title.trim() : "";
  const truncated = title.length > TITLE_MAX;
  if (truncated) title = title.slice(0, TITLE_MAX);
  const order = Number(data.order);
  return {
    legacyId: doc.id,
    userId: Number.isInteger(userId) && userId > 0 ? userId : null,
    title,
    subTitle: typeof data.subTitle === "string" ? data.subTitle : null,
    sequence: Number.isInteger(order) ? order : 0,
    createdAt: toDate(data.created_at) || new Date(),
    truncated,
  };
}

function neverChangedHere(row) {
  return row.updatedAt.getTime() <= row.createdAt.getTime() + TIMESTAMP_TOLERANCE_MS;
}

async function readAllTemplates(firestore) {
  const docs = [];
  let last = null;
  for (;;) {
    let q = firestore.collection("templates").orderBy("__name__").limit(PAGE_SIZE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    docs.push(...snap.docs);
    if (snap.size < PAGE_SIZE) break;
    last = snap.docs[snap.docs.length - 1];
  }
  return docs;
}

async function run() {
  const firestore = initFirestore();
  const tally = {
    firestoreDocs: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    keptAppEdit: 0,
    keptDeletedHere: 0,
    skippedNoUser: 0,
    skippedNoTitle: 0,
    titlesTruncated: 0,
    goneFromFirestore: 0,
    removed: 0,
  };

  const docs = await readAllTemplates(firestore);
  tally.firestoreDocs = docs.length;
  console.log(`Read ${docs.length} Firestore template doc(s).`);

  const parsed = docs.map(parseDoc);
  const userIds = [...new Set(parsed.map((p) => p.userId).filter(Boolean))];
  const existingUsers = new Set(
    (await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id"], raw: true })).map((u) => u.id)
  );

  // paranoid:false — soft-deleted rows count as "already imported".
  const rows = await Template.findAll({ where: { legacyId: { [Op.ne]: null } }, paranoid: false });
  const rowByLegacy = new Map(rows.map((r) => [r.legacyId, r]));

  const inserts = [];
  const updates = [];
  for (const p of parsed) {
    if (!p.title) {
      tally.skippedNoTitle++;
      if (VERBOSE) console.log(`  skip ${p.legacyId}: empty title`);
      continue;
    }
    if (!p.userId || !existingUsers.has(p.userId)) {
      tally.skippedNoUser++;
      if (VERBOSE) console.log(`  skip ${p.legacyId}: user ${p.userId} not found`);
      continue;
    }
    if (p.truncated) tally.titlesTruncated++;

    const row = rowByLegacy.get(p.legacyId);
    if (!row) {
      inserts.push({
        userId: p.userId,
        title: p.title,
        subTitle: p.subTitle,
        sequence: p.sequence,
        legacyId: p.legacyId,
        createdAt: p.createdAt,
        updatedAt: p.createdAt,
      });
      if (VERBOSE) console.log(`  create ${p.legacyId} for user ${p.userId}: "${p.title}"`);
      continue;
    }
    if (row.deletedAt) {
      tally.keptDeletedHere++;
      continue;
    }
    const changes = {};
    if (row.title !== p.title) changes.title = p.title;
    if ((row.subTitle ?? null) !== p.subTitle) changes.subTitle = p.subTitle;
    if (row.sequence !== p.sequence) changes.sequence = p.sequence;
    if (!Object.keys(changes).length) {
      tally.unchanged++;
    } else if (!neverChangedHere(row)) {
      tally.keptAppEdit++;
      if (VERBOSE) console.log(`  keep ${p.legacyId} (template ${row.id}): changed in this app`);
    } else {
      updates.push({ id: row.id, changes });
      if (VERBOSE) console.log(`  update template ${row.id} (${p.legacyId}): ${Object.keys(changes).join(",")}`);
    }
  }

  const inFirestore = new Set(docs.map((d) => d.id));
  const gone = rows.filter((r) => !r.deletedAt && !inFirestore.has(r.legacyId));
  tally.goneFromFirestore = gone.length;
  const toRemove = REMOVE_DELETED ? gone.filter(neverChangedHere) : [];

  if (COMMIT) {
    await db.transaction(async (t) => {
      if (inserts.length) await Template.bulkCreate(inserts, { transaction: t });
      for (const u of updates) {
        await Template.update(u.changes, { where: { id: u.id }, silent: true, transaction: t });
      }
      if (toRemove.length) {
        await Template.destroy({ where: { id: { [Op.in]: toRemove.map((r) => r.id) } }, transaction: t });
      }
    });
  }

  tally.created = inserts.length;
  tally.updated = updates.length;
  tally.removed = toRemove.length;

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(tally, null, 2));
  if (tally.goneFromFirestore && !REMOVE_DELETED) {
    console.log(`\n${tally.goneFromFirestore} template(s) are in MySQL but no longer in Firestore — re-run with --remove-deleted to delete them.`);
  }
  if (!COMMIT) console.log("\nDRY RUN — nothing was written. Re-run with --commit to apply.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("SYNC FAILED:", err);
    process.exit(1);
  });
