const axios = require("axios");
const jwt = require("jsonwebtoken");

// Verifies a Google Sign-In ID token without Firebase: checks Google's RS256
// signature against its published certs, plus audience, issuer and expiry.
// GOOGLE_CLIENT_IDS is the comma-separated list of OAuth client ids the app
// requests tokens for — with google_sign_in's `serverClientId` that's the
// project's *Web* client id (the token's `aud`).
const CERTS_URL = "https://www.googleapis.com/oauth2/v1/certs";
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

let certCache = { certs: null, expiresAt: 0 };

async function getCerts(forceRefresh = false) {
  if (!forceRefresh && certCache.certs && Date.now() < certCache.expiresAt) {
    return certCache.certs;
  }
  const res = await axios.get(CERTS_URL, { timeout: 5000 });
  const maxAge = /max-age=(\d+)/.exec(res.headers["cache-control"] || "");
  certCache = {
    certs: res.data,
    expiresAt: Date.now() + (maxAge ? Number(maxAge[1]) : 3600) * 1000,
  };
  return certCache.certs;
}

class InvalidGoogleTokenError extends Error {}

async function verifyGoogleIdToken(idToken) {
  const audiences = (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!audiences.length) {
    throw new Error("GOOGLE_CLIENT_IDS is not configured");
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new InvalidGoogleTokenError("Malformed Google ID token");
  }

  // Google rotates its keys; an unknown kid means our cached set is stale.
  let pem = (await getCerts())[decoded.header.kid];
  if (!pem) pem = (await getCerts(true))[decoded.header.kid];
  if (!pem) throw new InvalidGoogleTokenError("Unknown Google signing key");

  let payload;
  try {
    payload = jwt.verify(idToken, pem, {
      algorithms: ["RS256"],
      audience: audiences,
      issuer: ISSUERS,
    });
  } catch (err) {
    throw new InvalidGoogleTokenError(err.message);
  }

  if (!payload.email || String(payload.email_verified) !== "true") {
    throw new InvalidGoogleTokenError("Google account email is not verified");
  }
  return payload;
}

module.exports = { verifyGoogleIdToken, InvalidGoogleTokenError };
