// authMiddleware (middlewares/authenticate.js) always runs before this —
// every route below wires them in that order — and it already attaches the
// full user + roles to req.user. This used to re-fetch that same
// user-with-roles from the DB again here via a second, identical query on
// every single role-gated request; now it just reads what's already on
// req.user, which also means this no longer needs to be async.
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!user.roles || !user.roles.length) {
        return res.status(403).json({ message: "Forbidden: No roles assigned" });
      }

      const userRoles = user.roles.map((role) => role.name);
      const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

      if (!hasPermission) {
        return res.status(403).json({ message: "Forbidden: Access denied" });
      }

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

module.exports = authorize;
