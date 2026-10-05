// What one user may see about another. The account owner and platform admins
// get the full record (the app's own wallet screens and the admin "member
// wallets" screen rely on it); everyone else gets the profile without the
// payment code, push token, wallets or balances.

const PRIVATE_FIELDS = [
  "password",
  "otp",
  "resetToken",
  "tokenVersion",
  "fcm",
  "personalWalletBalance",
  "usdWalletBalance",
  "companyWalletBalance",
  "wallets",
  "walletSummary",
];

const isAdmin = (viewer) => !!viewer && (viewer.roles || []).some((r) => r.name === "admin");

function plain(user) {
  if (!user) return user;
  return typeof user.toJSON === "function" ? user.toJSON() : { ...user };
}

function stripPrivate(user) {
  const u = plain(user);
  if (!u) return u;
  for (const f of PRIVATE_FIELDS) delete u[f];
  let settings = u.settings;
  if (typeof settings === "string") {
    try {
      settings = JSON.parse(settings);
    } catch (e) {
      settings = null;
    }
  }
  if (settings && typeof settings === "object") {
    const { paymentCode, ...rest } = settings;
    u.settings = rest;
  }
  return u;
}

/** The record as `viewer` (req.user) is allowed to see it. */
function forViewer(user, viewer) {
  if (!user) return user;
  const u = plain(user);
  if (viewer && (isAdmin(viewer) || Number(viewer.id) === Number(u.id))) return u;
  return stripPrivate(u);
}

/** The few fields a public "does this email exist" lookup may reveal. */
function publicIdentity(user) {
  const u = plain(user);
  if (!u) return u;
  return { id: u.id, email: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName, profilePic: u.profilePic };
}

module.exports = { forViewer, stripPrivate, publicIdentity, isAdmin };
