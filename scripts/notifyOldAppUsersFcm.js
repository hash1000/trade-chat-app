#!/usr/bin/env node
"use strict";

// "Please update the app" push via FCM to users still on an old app build:
// no JPush registration (every 3.1.0+ install registers one) but an FCM
// token from the old app. Reaches phones with Google services, i.e. mostly
// users outside mainland China. Safe to run daily — anyone who updates drops
// out automatically.
//
// Tokens FCM reports as dead (app uninstalled / token rotated) are cleared
// from users.fcm on --commit, so later runs and NotificationService skip them.
//
// Usage:
//   node scripts/notifyOldAppUsersFcm.js                 # dry run: counts only
//   node scripts/notifyOldAppUsersFcm.js --test=516      # push to one user id only
//   node scripts/notifyOldAppUsersFcm.js --commit        # push to everyone on an old build
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
const { Op } = require("sequelize");
const { User } = require("../models");
const Version = require("../models/version");
const { PLAY_STORE_URL } = require("../config/appLinks");

const args = process.argv.slice(2);
const arg = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const COMMIT = args.includes("--commit");
const TEST_USER = arg("test") ? Number(arg("test")) : null;
const BATCH_SIZE = 500; // FCM multicast limit
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

function initFirebase() {
  const saPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.join(__dirname, "..", "config", "firebase-service-account.json")
  );
  if (!fs.existsSync(saPath)) throw new Error(`No Firebase service account found at ${saPath}`);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
  return admin.messaging();
}

async function run() {
  let version = arg("version");
  if (!version) {
    const latest = await Version.findOne({ order: [["createdAt", "DESC"]], attributes: ["version"] });
    version = latest && latest.version;
  }
  if (!version) throw new Error("No version found — pass --version=");

  const where = TEST_USER
    ? { id: TEST_USER }
    : { jpushRegistrationId: null, fcm: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] } };
  const users = await User.findAll({ where, attributes: ["id", "fcm"], raw: true });

  // One push per device: several accounts can share the same phone's token.
  const usersByToken = new Map();
  for (const u of users) {
    if (!u.fcm) continue;
    if (!usersByToken.has(u.fcm)) usersByToken.set(u.fcm, []);
    usersByToken.get(u.fcm).push(u.id);
  }
  const tokens = [...usersByToken.keys()];
  console.log(`Version ${version}: ${users.length} user(s) on an old build with an FCM token, ${tokens.length} device(s).`);

  if (!COMMIT && !TEST_USER) {
    console.log("\nDRY RUN — nothing sent. Add --commit to send (or --test=<userId> for one user).");
    return;
  }
  if (!tokens.length) return;

  const messaging = initFirebase();
  const payload = {
    notification: {
      title: "Please update NaskoChina",
      body: `Version ${version} is available. Older versions can no longer connect — update on Google Play.`,
    },
    data: { type: "APP_UPDATE", version: String(version), url: PLAY_STORE_URL },
    android: { priority: "high" },
  };

  let ok = 0;
  const errorCounts = {};
  const deadUserIds = [];
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const res = await messaging.sendEachForMulticast({ tokens: batch, ...payload });
    res.responses.forEach((r, j) => {
      if (r.success) return void ok++;
      const code = (r.error && r.error.code) || "unknown";
      errorCounts[code] = (errorCounts[code] || 0) + 1;
      if (DEAD_TOKEN_CODES.has(code)) deadUserIds.push(...usersByToken.get(batch[j]));
    });
  }

  console.log(`Delivered to FCM: ${ok}, failed: ${tokens.length - ok}`);
  if (Object.keys(errorCounts).length) console.log("Failures by reason:", errorCounts);
  if (COMMIT && deadUserIds.length) {
    const [cleared] = await User.update({ fcm: null }, { where: { id: { [Op.in]: deadUserIds } } });
    console.log(`Cleared ${cleared} dead FCM token(s) from users.fcm.`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exit(1);
  });
