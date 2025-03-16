const { User, Role } = require("../models");
const UserService = require('../services/UserService')

const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id; // Ensure req.user is set by the authenticate middleware
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      // Fetch user along with their roles through the user_roles junction table
      const userService = new UserService()
      const user = await userService.getUserById(userId)
    console.log("user",user);
    
      if (!user || !user.roles.length) {
        return res.status(403).json({ message: "Forbidden: No roles assigned" });
      }

      // Extract role names
      const userRoles = user.roles.map((role) => role.name);

      console.log("userRoles",userRoles);
      // Check if the user has an allowed role
      const hasPermission = allowedRoles.some((role) => userRoles.includes(role));

      console.log("hasPermission",hasPermission);
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
