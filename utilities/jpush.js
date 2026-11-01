const axios = require("axios");

// JPush (JiGuang) REST API v3 — push that reaches mainland China (through the
// Huawei/Xiaomi/OPPO/vivo/Honor vendor channels configured in the JPush
// console), iOS via APNs, and overseas Android.
//
// Env:
//   JPUSH_APP_KEY, JPUSH_MASTER_SECRET   from the JPush console (app settings)
//   JPUSH_APNS_PRODUCTION                "false" for TestFlight/dev builds; default true
//   JPUSH_THIRD_PARTY_CHANNEL            optional JSON for options.third_party_channel
//                                        (vendor channel_id / category / importance),
//                                        e.g. {"xiaomi":{"channel_id":"123"},"vivo":{"category":"IM"}}
const PUSH_URL = "https://api.jpush.cn/v3/push";

// JPush rejects payloads over ~4KB (same as FCM/APNs). Text is capped; JSON
// extras (e.g. the full chat `message`) are never cut — truncated JSON can't
// be parsed — so the largest ones are dropped instead until the extras fit,
// and the app falls back to fetching (it opens the chat by chatId).
const MAX_BODY_CHARS = 150; // a notification shows ~2 lines; CJK is 3 bytes/char
const MAX_EXTRA_CHARS = 480;
const MAX_EXTRAS_BYTES = 1200; // sent twice (android + ios)

function isConfigured() {
  return !!(process.env.JPUSH_APP_KEY && process.env.JPUSH_MASTER_SECRET);
}

function truncate(value, max) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

// Extras as strings, the same shape the app already parses from FCM `data`.
// Never dropped: what the app needs to open the right screen.
const ROUTING_KEYS = new Set(["type", "entityType", "entityId", "chatId", "userId"]);

function toStringExtras(data) {
  const extras = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === null || v === undefined) continue;
    extras[k] = typeof v === "object" ? JSON.stringify(v) : truncate(String(v), MAX_EXTRA_CHARS);
  }
  const droppable = Object.keys(extras)
    .filter((k) => !ROUTING_KEYS.has(k))
    .sort((a, b) => Buffer.byteLength(extras[b]) - Buffer.byteLength(extras[a]));
  for (const k of droppable) {
    if (Buffer.byteLength(JSON.stringify(extras)) <= MAX_EXTRAS_BYTES) break;
    delete extras[k];
  }
  return extras;
}

function thirdPartyChannel() {
  if (!process.env.JPUSH_THIRD_PARTY_CHANNEL) return undefined;
  try {
    return JSON.parse(process.env.JPUSH_THIRD_PARTY_CHANNEL);
  } catch (e) {
    console.error("JPUSH_THIRD_PARTY_CHANNEL is not valid JSON — ignored");
    return undefined;
  }
}

async function sendToRegistrationId(registrationId, title, body, data = {}) {
  const alert = truncate(String(body || ""), MAX_BODY_CHARS);
  title = truncate(String(title || ""), 60);
  const extras = toStringExtras(data);

  const payload = {
    platform: "all",
    audience: { registration_id: [registrationId] },
    notification: {
      android: { title, alert, extras },
      ios: { alert: { title, body: alert }, sound: "default", badge: "+1", extras },
    },
    options: {
      apns_production: process.env.JPUSH_APNS_PRODUCTION !== "false",
      time_to_live: 86400,
      // 1 = system/transactional message (chat, payments, orders). Vendor
      // channels throttle 0 ("operations"/marketing) to a few a day.
      classification: 1,
      third_party_channel: thirdPartyChannel(),
    },
  };

  const auth = Buffer.from(`${process.env.JPUSH_APP_KEY}:${process.env.JPUSH_MASTER_SECRET}`).toString("base64");
  const res = await axios.post(PUSH_URL, payload, {
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    timeout: 10000,
  });
  return res.data; // { sendno, msg_id }
}

module.exports = { isConfigured, sendToRegistrationId, toStringExtras };
