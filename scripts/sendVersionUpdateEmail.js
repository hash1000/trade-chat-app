#!/usr/bin/env node
"use strict";

// Sends the "new version" email (services/VersionEmailService.js) without
// going through the admin version screen. Recipients: users still on an old
// app build (no JPush registration), excluding @yopmail.com test accounts.
// Each address is emailed once per version; a run stops at 450 emails
// (Gmail's ~500/day limit) — run again the next day to continue.
//
// Usage:
//   node scripts/sendVersionUpdateEmail.js                  # dry run: counts + a few sample addresses
//   node scripts/sendVersionUpdateEmail.js --commit         # actually sends
//   node scripts/sendVersionUpdateEmail.js --test=me@x.com  # sends one email to that address only
//   node scripts/sendVersionUpdateEmail.js --reminder --commit
//                     reminder round: once per user per day (UTC), still only
//                     users who haven't updated. Keep reminders rare (every
//                     2-3 days) — repeated mail gets the Gmail account flagged
//                     as spam, which also blocks OTP/password-reset emails.
//   --version=3.1.0   override the version (default: the version row the app reads)
//   --limit=N         send at most N this run

require("dotenv").config();
const nodemailer = require("nodemailer");
const Version = require("../models/version");
const VersionEmailService = require("../services/VersionEmailService");
const { subject_mail, message } = require("../templates/email/email_version_update");

const args = process.argv.slice(2);
const arg = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const COMMIT = args.includes("--commit");
const ROUND = args.includes("--reminder") ? new Date().toISOString().slice(0, 10) : undefined;

function mask(email) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

async function run() {
  let version = arg("version");
  if (!version) {
    // Same row the app shows first (VersionController.getAll: newest createdAt).
    const latest = await Version.findOne({ order: [["createdAt", "DESC"]], attributes: ["version"] });
    version = latest && latest.version;
  }
  if (!version) throw new Error("No version found — pass --version=");

  const test = arg("test");
  if (test) {
    await nodemailer
      .createTransport({ service: "gmail", auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_PASSWORD } })
      .sendMail({ from: `"NaskoChina" <${process.env.EMAIL_ADDRESS}>`, to: test, subject: subject_mail, html: message(version) });
    console.log(`Test email for ${version} sent to ${test}.`);
    return;
  }

  const service = new VersionEmailService();
  const { pending, alreadySent } = await service.recipients(version, { round: ROUND });
  const limit = Number(arg("limit")) || VersionEmailService.MAX_PER_RUN;
  if (ROUND) console.log(`Reminder round ${ROUND}`);
  console.log(`Version ${version}: ${pending.length} to email, ${alreadySent} already emailed, this run sends up to ${Math.min(limit, pending.length)}.`);
  console.log(`Sample: ${pending.slice(0, 5).map(mask).join(", ") || "-"}`);

  if (!COMMIT) {
    console.log("\nDRY RUN — nothing sent. Add --commit to send.");
    return;
  }
  await service.send(version, { round: ROUND, limit });
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED:", err.message);
    process.exit(1);
  });
