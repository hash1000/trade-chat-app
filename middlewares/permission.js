const { Permission, User } = require("../models");

const checkPermission = (action, resource) => {
  return async (req, res, next) => {
    try {
      const userRoles = req.user.roles.map((role) => ({ id: role.id, name: role.name }));
      const roleIds = userRoles.map((role) => role.id);
      const roleNames = userRoles.map((role) => role.name);

      console.log("Checking permissions for:", roleNames, "Resource:", resource, "Action:", action);

      // Fetch permissions for the given roles
      const permissions = await Permission.findAll({
        where: { roleId: roleIds, resource },
      });

      if (!permissions || permissions.length === 0) {
        return res.status(403).json({ message: "Forbidden: No permissions assigned" });
      }

      // Check if the user has permission for the requested action
      const hasPermission = permissions.some((perm) => perm[action]);
      if (!hasPermission) {
        return res.status(403).json({ message: `Forbidden: No ${action} permission` });
      }

      // Extract ownData and allData flags
      const ownData = permissions.some((perm) => perm.ownData);
      const allData = permissions.some((perm) => perm.allData);
      const readAll = permissions.some((perm) => perm.readAll);

      // Attach permissions to request object
      req.permissions = { hasPermission, ownData, allData, readAll };
      req.userRoles = { ids: roleIds, names: roleNames };

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

module.exports = checkPermission;
