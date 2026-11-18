// #2151 (Nasko 18.11.2026): Chat QRM web sign-in through ID QRM (idqrm.com). ADD-ON ONLY: the old sign-in routes
// (/auth/login, /auth/google-signIn, OTP, phone) and the mobile app are not changed.
//
// Flow (same proven pattern as the ID QRM "Login Button" in redirect mode):
//   GET  /api/auth/idqrm/start  -> 302 idqrm.com/qrm/sso?client=..&origin=https://chatqrm.com&nonce=N&mode=redirect&ret=.../back
//                                  (N is also put in an HttpOnly cookie, so the answer is bound to THIS browser)
//   GET  /api/auth/idqrm/back   -> small page: reads #qrmid_credential=... from the fragment and POSTs it to /done
//   POST /api/auth/idqrm/done   -> checks the credential with POST idqrm.com/qrm/verify (signature, expiry, ONE-TIME use)
//                                  + aud / origin / iss / email_verified + nonce == cookie;
//                                  user = the Chat QRM account with exactly this verified email (same rule as Google sign-in),
//                                  otherwise a new user (same as Google sign-in); disabled -> refused;
//                                  then the SAME Chat QRM JWT as every other sign-in ({userId, tokenVersion}), valid 30 days,
//                                  saved in the browser like the web app does (localStorage nk_token / nk_user).
// v2 (Codex red team): no separate link store (email is the only key, like Google) · create race -> reload by email ·
//                      ID QRM down -> 503 "try again" (not "sign-in failed") · bad fragment -> back to start.
// v3 (#2159, Nasko GO 18.11): (a) pages get a strict CSP with a per-response nonce, no ACAO:* / X-Powered-By;
//    (b) POST /api/auth/idqrm/app for the MOBILE app: the app signs in with ID QRM (system browser + PKCE, AppAuth),
//        sends {id_token}; the server checks it against ID QRM's public keys (JWKS: RS256, iss, aud = the app's ID QRM
//        App ID, exp, email_verified), accepts each token once, then the same user rule + the same Chat QRM JWT (JSON).
const express = require("express");
const crypto = require("crypto");

const DEF = {
  iss: "https://idqrm.com",
  clientId: "qid_ac6943c5f7a76adc4ac5",
  appClientId: "qapp_300c96f148b352643650",
  origin: "https://chatqrm.com",
  base: "/api/auth/idqrm",
  tokenDays: 30,
  flowSec: 1800,
};
const CK = "cq_qid";
const CKR = "cq_rd";

const TXT = {
  en: { wait: "Signing in…", fail: "Sign-in failed", again: "Try again", busy: "ID QRM is not reachable right now. Please try again in a minute.",
        disabled: "This account is disabled.", help: "Please contact QRM support." },
  bg: { wait: "Влизане…", fail: "Входът не успя", again: "Опитай отново", busy: "ID QRM не отговаря в момента. Опитай отново след минута.",
        disabled: "Този акаунт е блокиран.", help: "Свържи се с поддръжката на QRM." },
  zh: { wait: "正在登录…", fail: "登录失败", again: "重试", busy: "ID QRM 暂时无法连接，请稍后再试。", disabled: "此账户已被停用。", help: "请联系 QRM 客服。" },
};
const CSS =
  "<style>body{margin:0;background:#f2f2f7;color:#000;font:17px/1.4 -apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,system-ui,sans-serif;" +
  "-webkit-font-smoothing:antialiased;text-align:center;padding:96px 24px}h1{font-size:24px;font-weight:600;margin:0 0 10px}" +
  "p{color:#3c3c43;margin:0 0 22px}a{display:inline-block;background:#007aff;color:#fff;text-decoration:none;font-weight:600;border-radius:12px;padding:14px 28px}" +
  "@media (prefers-color-scheme:dark){body{background:#000;color:#fff}p{color:#ebebf5}}</style>";

class Upstream extends Error {}

function lang(req) {
  const a = String(req.headers["accept-language"] || "").toLowerCase();
  const m = a.match(/(zh|bg|en)/);
  return m ? m[1] : "en";
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function safeRd(v) {
  const s = String(v || "");
  if (s.length > 300 || !/^\/(?!\/)[A-Za-z0-9\-._~\/?=&%+]*$/.test(s) || /^\/(api|login|signup|forgot-password)(\/|$|\?)/.test(s)) return "/";
  return s;
}
function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}
function js(x) {
  return JSON.stringify(x).replace(/</g, "\\u003c");
}
function page(res, code, title, body) {
  const n = crypto.randomBytes(16).toString("base64");
  res.status(code);
  res.removeHeader("Access-Control-Allow-Origin");
  res.removeHeader("X-Powered-By");
  res.set({
    "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; script-src 'nonce-" + n + "'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff",
  });
  return res.send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="robots" content="noindex,nofollow"><title>' + esc(title) + "</title>" + CSS + "</head><body>" +
      String(body).split("<script>").join('<script nonce="' + n + '">') + "</body></html>"
  );
}

function make(opts) {
  const o = Object.assign({}, DEF, opts || {});
  let d = o.deps || null;
  const deps = () => d || (d = realDeps(o));
  const router = express.Router();
  const ckOpt = { httpOnly: true, secure: true, sameSite: "lax", path: o.base };
  const seen = new Map(); // one-time use of app ID tokens: sha256(token) -> expiry ms

  function fail(req, res, code, why, msg) {
    const t = TXT[lang(req)];
    console.warn("idqrm sign-in refused:", code, why);
    res.clearCookie(CK, ckOpt); res.clearCookie(CKR, ckOpt);
    return page(res, code, "Chat QRM", "<h1>" + esc(t.fail) + "</h1>" + (msg ? "<p>" + esc(msg) + "</p>" : "<p></p>") +
      '<a href="' + o.base + '/start">' + esc(t.again) + "</a>");
  }
  function jfail(res, code, why) {
    console.warn("idqrm app sign-in refused:", code, why);
    res.set("Cache-Control", "no-store");
    return res.status(code).json({ ok: false, error: why });
  }

  // the same user rule for web and app: account with exactly this verified email, otherwise a new one (race-safe)
  async function userFor(email, name) {
    let u = await deps().byEmail(email);
    let created = false;
    if (!u) {
      try {
        u = await deps().create(email, name);
        created = true;
      } catch (e) {
        u = await deps().byEmail(email); // a parallel first sign-in created it a moment ago
        if (!u) throw e;
      }
    }
    return { u, created };
  }
  function nameOf(j, email) {
    let name = String(j.name || [j.given_name, j.family_name].filter(Boolean).join(" ") || "").trim().slice(0, 60);
    if (!name || name.indexOf("@") >= 0) name = email.split("@")[0];
    return name;
  }
  function pubOf(u) {
    const pub = typeof u.toJSON === "function" ? u.toJSON() : Object.assign({}, u);
    delete pub.password;
    return pub;
  }

  router.get("/start", (req, res) => {
    const nonce = crypto.randomBytes(24).toString("base64url");
    res.cookie(CK, nonce, Object.assign({ maxAge: o.flowSec * 1000 }, ckOpt));
    res.cookie(CKR, safeRd(req.query.rd), Object.assign({ maxAge: o.flowSec * 1000 }, ckOpt));
    res.set("Cache-Control", "no-store");
    const q = new URLSearchParams({ client: o.clientId, origin: o.origin, nonce: nonce, mode: "redirect", ret: o.origin + o.base + "/back" });
    return res.redirect(302, o.iss + "/qrm/sso?" + q.toString());
  });

  router.get("/back", (req, res) => {
    const t = TXT[lang(req)];
    return page(res, 200, "Chat QRM",
      "<p>" + esc(t.wait) + '</p><form id="f" method="post" action="' + o.base + '/done"><input type="hidden" name="credential" value=""></form>' +
      '<script>(function(){var h=location.hash||"",k="#qrmid_credential=",s="' + o.base + '/start",v;' +
      'try{history.replaceState(null,"",location.pathname)}catch(x){}' +
      "if(h.indexOf(k)!==0||h.length>6000){location.replace(s);return}" +
      "try{v=decodeURIComponent(h.slice(k.length))}catch(x){location.replace(s);return}" +
      'var f=document.getElementById("f");f.credential.value=v;f.submit()})();</script>');
  });

  router.post("/done", async (req, res) => {
    const t = TXT[lang(req)];
    try {
      const cred = String((req.body && req.body.credential) || "");
      const bind = String((req.cookies && req.cookies[CK]) || "");
      const rd = safeRd(req.cookies && req.cookies[CKR]);
      if (cred.length < 20 || cred.length > 4000 || !bind) return fail(req, res, 400, "input");
      let j = null;
      try {
        j = await deps().verify(cred, o.clientId);
      } catch (e) {
        if (e instanceof Upstream || (e && e.upstream)) return fail(req, res, 503, "idqrm_down", t.busy);
        j = null;
      }
      if (!j || typeof j !== "object" || j.valid !== true || j.aud !== o.clientId || j.origin !== o.origin || j.iss !== o.iss ||
          j.email_verified !== true || !j.email || !j.sub || !same(j.nonce || "", bind)) {
        return fail(req, res, 401, "verify");
      }
      const email = String(j.email).trim().toLowerCase();
      const { u, created } = await userFor(email, nameOf(j, email));
      if (!u || !u.id) return fail(req, res, 500, "user");
      if (String(u.email || "").trim().toLowerCase() !== email) return fail(req, res, 409, "email_mismatch");
      if (u.disableAccount) return fail(req, res, 403, "disabled", t.disabled + " " + t.help);
      const tok = deps().sign(u);
      console.log("idqrm sign-in ok: user", u.id, created ? "(new)" : "");
      res.clearCookie(CK, ckOpt); res.clearCookie(CKR, ckOpt);
      return page(res, 200, "Chat QRM",
        "<p>" + esc(t.wait) + "</p><script>(function(){try{localStorage.removeItem(\"nk_demo_session\");" +
        "localStorage.setItem(\"nk_token\"," + js(tok) + ");localStorage.setItem(\"nk_user\"," + js(JSON.stringify(pubOf(u))) + ")}catch(e){}" +
        "location.replace(" + js(rd) + ")})();</script>");
    } catch (e) {
      console.error("idqrm sign-in error:", e && e.message);
      return fail(req, res, 500, "error");
    }
  });

  // mobile app: {id_token} from ID QRM (AppAuth, PKCE) -> {ok, token, user}
  router.post("/app", async (req, res) => {
    try {
      const idt = String((req.body && (req.body.id_token || req.body.idToken)) || "");
      if (idt.length < 40 || idt.length > 8000 || idt.split(".").length !== 3) return jfail(res, 400, "input");
      let j = null;
      try {
        j = await deps().idToken(idt);
      } catch (e) {
        if (e instanceof Upstream || (e && e.upstream)) return jfail(res, 503, "idqrm_down");
        j = null;
      }
      const aud = j && (Array.isArray(j.aud) ? j.aud : [j.aud]);
      const now = Math.floor(Date.now() / 1000);
      if (!j || typeof j !== "object" || j.iss !== o.iss || !aud || aud.indexOf(o.appClientId) < 0 || !(j.exp > now) ||
          j.email_verified !== true || !j.email || !j.sub) {
        return jfail(res, 401, "verify");
      }
      if (req.body && req.body.nonce != null && !same(String(j.nonce || ""), String(req.body.nonce))) return jfail(res, 401, "nonce");
      const h = crypto.createHash("sha256").update(idt).digest("hex");
      const t0 = Date.now();
      if (seen.size > 5000) for (const [k, v] of seen) if (v < t0) seen.delete(k);
      if (seen.has(h) && seen.get(h) > t0) return jfail(res, 401, "used");
      seen.set(h, j.exp * 1000);
      const email = String(j.email).trim().toLowerCase();
      const { u, created } = await userFor(email, nameOf(j, email));
      if (!u || !u.id) return jfail(res, 500, "user");
      if (String(u.email || "").trim().toLowerCase() !== email) return jfail(res, 409, "email_mismatch");
      if (u.disableAccount) return jfail(res, 403, "disabled");
      console.log("idqrm app sign-in ok: user", u.id, created ? "(new)" : "");
      res.set("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, token: deps().sign(u), user: pubOf(u), created: created });
    } catch (e) {
      console.error("idqrm app sign-in error:", e && e.message);
      return jfail(res, 500, "error");
    }
  });

  return router;
}

function realDeps(o) {
  const axios = require("axios");
  const jwt = require("jsonwebtoken");
  const UserService = require("../services/UserService");
  const us = new UserService();
  let jw = { at: 0, keys: {} };
  async function jwks(force) {
    if (!force && Date.now() - jw.at < 600000 && Object.keys(jw.keys).length) return jw.keys;
    if (force && Date.now() - jw.at < 60000) return jw.keys; // refresh on an unknown kid at most once a minute
    let r;
    try {
      r = await axios.get(o.iss + "/jwks.json", { timeout: 10000, validateStatus: () => true, headers: { "User-Agent": "chat-qrm-idqrm/3" } });
    } catch (e) {
      throw new Upstream("jwks network: " + (e && e.code));
    }
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.keys)) throw new Upstream("jwks status " + r.status);
    const keys = {};
    for (const k of r.data.keys) if (k && k.kty === "RSA" && k.kid) keys[k.kid] = crypto.createPublicKey({ key: k, format: "jwk" }).export({ type: "spki", format: "pem" });
    jw = { at: Date.now(), keys };
    return keys;
  }
  return {
    verify: async (cred, cid) => {
      let r;
      try {
        r = await axios.post(o.iss + "/qrm/verify", new URLSearchParams({ client_id: cid, credential: cred }).toString(), {
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "chat-qrm-idqrm/2" },
          timeout: 15000,
          validateStatus: () => true,
        });
      } catch (e) {
        throw new Upstream("network: " + (e && e.code));
      }
      if (r.status >= 500) throw new Upstream("status " + r.status);
      return r.status === 200 ? r.data : null;
    },
    idToken: async (tok) => {
      let kid = "";
      try {
        kid = JSON.parse(Buffer.from(tok.split(".")[0], "base64url").toString()).kid || "";
      } catch (e) {
        return null;
      }
      let keys = await jwks(false);
      if (!keys[kid]) keys = await jwks(true);
      if (!keys[kid]) return null;
      try {
        return jwt.verify(tok, keys[kid], { algorithms: ["RS256"], issuer: o.iss, audience: o.appClientId, clockTolerance: 30 });
      } catch (e) {
        return null;
      }
    },
    byEmail: (email) => us.getUserByEmail(email),
    create: async (email, name) => {
      const n = await us.createGoogleUser({ username: name, email: email, profilePic: null, email_verified: true, fromLogin: "EMAIL" });
      await us.updateUserProfile(n, { email_verified: true });
      return us.getUserById(n.id);
    },
    sign: (u) => jwt.sign({ userId: u.id, tokenVersion: u.tokenVersion }, process.env.JWT_SECRET_KEY, { expiresIn: o.tokenDays * 86400 }),
  };
}

module.exports = make;
module.exports.make = make;
module.exports.Upstream = Upstream;
module.exports._t = { safeRd, same, lang, js };
