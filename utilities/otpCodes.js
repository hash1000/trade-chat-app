"use strict";

// One-time codes sent by SMS or email.
//
// Rules (agreed with Nasko, Step 0):
//   - 6 random digits (crypto.randomInt, not Math.random)
//   - only an HMAC of the code is stored, never the code itself
//   - one-time: a code is cleared the moment it is accepted
//   - max 5 wrong tries, then a new code is needed
//   - max 5 codes per hour per phone number / email
//
// Phone codes and the "change email" code live in the `otp` table (one row per
// contact). The email sign-in / sign-up codes live in `EmailOtp` (one row per
// send, found through the encrypted verification_key the app sends back).

const crypto = require("crypto");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const OTP = require("../models/otp");
const EmailOtp = require("../models/email_otp");

const CODE_DIGITS = 6;
const MAX_WRONG_TRIES = 5;
const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

class OtpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let cachedKey = null;
function hashKey() {
  if (cachedKey) return cachedKey;
  const secret = process.env.OTP_HASH_SECRET || process.env.JWT_SECRET_KEY;
  if (!secret) throw new Error("OTP_HASH_SECRET or JWT_SECRET_KEY must be set");
  // A separate key derived for codes, so a code hash is never a JWT signature.
  cachedKey = crypto.createHmac("sha256", secret).update("chatqrm-otp-v1").digest();
  return cachedKey;
}

function newCode() {
  return crypto.randomInt(0, 10 ** CODE_DIGITS).toString().padStart(CODE_DIGITS, "0");
}

// `scope` ties the hash to who the code was sent to, so a code for one number
// can never match another number's row.
function hashCode(scope, code) {
  return crypto
    .createHmac("sha256", hashKey())
    .update(`${scope}\n${String(code).trim()}`)
    .digest("hex");
}

function sameHash(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// ---------------------------------------------------------------- otp table

function latestContactRow(contact) {
  return OTP.findOne({ where: { contact }, order: [["id", "DESC"]] });
}

/**
 * Makes a new code for `contact` (e.g. "+923001234567"), stores its hash and
 * returns the plain code so the caller can send it. Throws OtpError(429) when
 * 5 codes were already sent in the last hour.
 */
async function issueContactCode(contact, contactType, ttlMinutes) {
  const now = new Date();
  let row = await latestContactRow(contact);

  const windowStart = row && row.send_window_start ? new Date(row.send_window_start) : null;
  const windowOpen = windowStart && now - windowStart < HOUR_MS;
  const sentThisHour = windowOpen ? row.send_count || 0 : 0;
  if (sentThisHour >= MAX_SENDS_PER_HOUR) {
    throw new OtpError(429, "too_many_codes", "Too many codes requested. Please try again later.");
  }

  const code = newCode();
  const fields = {
    otp: null, // the old plain-code column is no longer used
    code_hash: hashCode(contact, code),
    attempts: 0,
    verified: false,
    expiration_time: new Date(now.getTime() + ttlMinutes * 60 * 1000),
    send_count: sentThisHour + 1,
    send_window_start: windowOpen ? windowStart : now,
    updated_at: now,
  };
  if (row) {
    await row.update(fields);
  } else {
    row = await OTP.create({ contact, contact_type: contactType, ...fields });
  }
  return code;
}

/**
 * Checks `code` against the latest code sent to `contact` and uses it up on
 * success. Returns { ok: true } or { ok: false, reason }.
 */
async function checkContactCode(contact, code) {
  const row = await latestContactRow(contact);
  if (!row || !row.code_hash) {
    return { ok: false, reason: "Please request a new code." };
  }

  // Count this try first, in one UPDATE, so parallel guesses can't get past
  // the limit.
  const [counted] = await OTP.update(
    { attempts: sequelize.literal("attempts + 1") },
    { where: { id: row.id, code_hash: row.code_hash, attempts: { [Op.lt]: MAX_WRONG_TRIES } } }
  );
  if (!counted) {
    return { ok: false, reason: "Too many wrong codes. Please request a new code." };
  }
  if (new Date() > new Date(row.expiration_time)) {
    return { ok: false, reason: "The code has expired. Please request a new code." };
  }
  if (!sameHash(row.code_hash, hashCode(contact, code))) {
    return { ok: false, reason: "The code is incorrect." };
  }

  // One-time: only the request that clears the hash wins.
  const [used] = await OTP.update(
    { code_hash: null, verified: true, updated_at: new Date() },
    { where: { id: row.id, code_hash: row.code_hash } }
  );
  if (!used) {
    return { ok: false, reason: "The code was already used. Please request a new code." };
  }
  return { ok: true };
}

// ----------------------------------------------------------- EmailOtp table

/**
 * New email code. Returns { code, id }: `id` goes into the encrypted
 * verification_key, `code` into the email.
 */
async function issueEmailCode(email, ttlMinutes) {
  const contact = normalizeEmail(email);
  const now = new Date();
  const sentThisHour = await EmailOtp.count({
    where: { contact, created_at: { [Op.gt]: new Date(now.getTime() - HOUR_MS) } },
  });
  if (sentThisHour >= MAX_SENDS_PER_HOUR) {
    throw new OtpError(429, "too_many_codes", "Too many codes requested. Please try again later.");
  }
  const code = newCode();
  const row = await EmailOtp.create({
    contact,
    otp: hashCode(`email:${contact}`, code),
    attempts: 0,
    expiration_time: new Date(now.getTime() + ttlMinutes * 60 * 1000),
    created_at: now,
    updated_at: now,
  });
  return { code, id: row.id };
}

/**
 * Checks an email code by its row id (from the verification_key) and uses it
 * up on success, unless `consume` is false (sign-up check before the account
 * exists). Wrong tries are always counted. Returns { ok: true } or
 * { ok: false, reason }.
 */
async function checkEmailCode(id, email, code, { consume = true } = {}) {
  const contact = normalizeEmail(email);
  const row = await EmailOtp.findOne({ where: { id } });
  if (!row || row.verified || (row.contact && row.contact !== contact)) {
    return { ok: false, reason: "Please request a new code." };
  }

  const [counted] = await EmailOtp.update(
    { attempts: sequelize.literal("attempts + 1") },
    { where: { id: row.id, verified: false, attempts: { [Op.lt]: MAX_WRONG_TRIES } } }
  );
  if (!counted) {
    return { ok: false, reason: "Too many wrong codes. Please request a new code." };
  }
  if (new Date() > new Date(row.expiration_time)) {
    return { ok: false, reason: "OTP Expired" };
  }
  if (!sameHash(row.otp, hashCode(`email:${contact}`, code))) {
    return { ok: false, reason: "OTP NOT Matched" };
  }
  if (!consume) return { ok: true };

  const [used] = await EmailOtp.update(
    { verified: true, updated_at: new Date() },
    { where: { id: row.id, verified: false } }
  );
  if (!used) {
    return { ok: false, reason: "OTP Already Used" };
  }
  return { ok: true };
}

module.exports = {
  OtpError,
  issueContactCode,
  checkContactCode,
  issueEmailCode,
  checkEmailCode,
  normalizeEmail,
  MAX_WRONG_TRIES,
  MAX_SENDS_PER_HOUR,
};
