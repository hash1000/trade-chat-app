const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { Op } = require("sequelize");
const User = require("../models/user");
const { subject_mail, message } = require("../templates/email/email_version_update");

// "New version" emails. Sent only to users still on an old app build (no
// JPush registration yet — every 3.1.0+ install registers one), never to
// test accounts. Each address gets one email per version: sent addresses are
// recorded in logs/version-email-<version>.sent, so re-running (or saving the
// version screen again) only reaches whoever hasn't been emailed yet. A run
// stops at MAX_PER_RUN to stay under Gmail's ~500/day limit; run again the
// next day to continue.
const MAX_PER_RUN = 450;
const SEND_DELAY_MS = 300;
const EXCLUDED_DOMAINS = ["yopmail.com"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOG_DIR = path.join(__dirname, "..", "logs");

function sentFile(version) {
  return path.join(LOG_DIR, `version-email-${String(version).replace(/[^0-9A-Za-z._-]/g, "_")}.sent`);
}

function readSent(version) {
  try {
    return new Set(fs.readFileSync(sentFile(version), "utf8").split("\n").filter(Boolean));
  } catch {
    return new Set();
  }
}

function markSent(version, email) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(sentFile(version), `${email}\n`);
}

class VersionEmailService {
  // Users on an old build with a usable, non-test address, minus anyone
  // already emailed for this version. Lower-cased and de-duplicated.
  async recipients(version) {
    const users = await User.findAll({
      where: {
        jpushRegistrationId: null,
        [Op.and]: EXCLUDED_DOMAINS.map((d) => ({ email: { [Op.notLike]: `%@${d}` } })),
      },
      attributes: ["email"],
      raw: true,
    });
    const already = readSent(version);
    const out = new Set();
    for (const { email } of users) {
      const e = String(email || "").trim().toLowerCase();
      if (EMAIL_RE.test(e) && !already.has(e)) out.add(e);
    }
    return { pending: [...out], alreadySent: already.size };
  }

  async send(version, { limit = MAX_PER_RUN, log = console.log } = {}) {
    const { pending, alreadySent } = await this.recipients(version);
    const batch = pending.slice(0, limit);
    if (!batch.length) {
      log(`Version ${version}: nothing to send (${alreadySent} already emailed).`);
      return { sent: 0, failed: 0, remaining: 0 };
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_ADDRESS, pass: process.env.EMAIL_PASSWORD },
    });
    const html = message(version);
    let sent = 0;
    const failed = [];
    for (const to of batch) {
      try {
        await transporter.sendMail({
          from: `"NaskoChina" <${process.env.EMAIL_ADDRESS}>`,
          to,
          subject: subject_mail,
          html,
        });
        markSent(version, to);
        sent++;
      } catch (err) {
        failed.push(to);
        log(`Version email failed for ${to}: ${err.message}`);
        // Gmail's daily limit: stop instead of failing every remaining address.
        if (/limit|quota|5\.4\.5|5\.5\.3/i.test(err.message)) break;
      }
      await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
    }
    const remaining = pending.length - sent;
    log(`Version ${version}: sent ${sent}, failed ${failed.length}, still to send ${remaining}.`);
    return { sent, failed: failed.length, remaining };
  }
}

module.exports = VersionEmailService;
module.exports.MAX_PER_RUN = MAX_PER_RUN;
