const { User, Role } = require("../models");

const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id; // Ensure req.user is set by the authenticate middleware
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Fetch user along with their roles through the User_Roles junction table
      const user = await User.findByPk(userId, {
        include: [
            {
                model: Role,
                as: "roles",
            },
        ],
    });
    console.log("user",user);
    
      if (!user || !user.roles.length) {
        return res.status(403).json({ message: "Forbidden: No roles assigned" });
      }

      // Extract role names
      const userRoles = user.roles.map((role) => role.name);

      // Check if the user has an allowed role
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
