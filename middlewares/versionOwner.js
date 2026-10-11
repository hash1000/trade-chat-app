// Only these accounts may add, change or delete app versions (on top of the
// admin role): a wrong version entry pushes every app user to update.
// Set APP_VERSION_ADMIN_EMAILS (comma-separated) to change who; the default is
// the owner's account. Runs after authenticate + authorize(["admin"]).
const DEFAULT_OWNERS = "noumanhabib0348@gmail.com";

const owners = () =>
  (process.env.APP_VERSION_ADMIN_EMAILS || DEFAULT_OWNERS)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

module.exports = function versionOwner(req, res, next) {
  const email = String((req.user && req.user.email) || "").toLowerCase();
  if (!email || !owners().includes(email)) {
    return res.status(403).json({ success: false, message: "Only the app owner can manage app versions." });
  }
  next();
};
