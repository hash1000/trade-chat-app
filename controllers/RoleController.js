const CustomError = require("../errors/CustomError");
const RoleService = require("../services/RoleService");

const roleService = new RoleService();

class RoleController {
  async getAllRoles(req, res) {
    try {
      const roles = await roleService.getAllRoles();
      return res.json({ roles });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Failed to fetch roles" });
    }
  }

  async getUsersByRole(req, res) {
    try {
      const { role } = req.query;
      const data = await roleService.getUsersByRole(role);
      return res.json(data);
    } catch (error) {
      console.error(error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Failed to list users by role" });
    }
  }

  async updateUserRoles(req, res) {
    try {
      const { requesteeId, roles } = req.body;
      const data = await roleService.updateUserRoles(requesteeId, roles);
      return res.json(data);
    } catch (error) {
      console.error(error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Failed to update user roles" });
    }
  }

  async bulkUpdateUserRoles(req, res) {
    try {
      const { userIds, roles } = req.body;
      const data = await roleService.bulkUpdateUserRoles(userIds, roles);
      return res.json(data);
    } catch (error) {
      console.error(error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Failed to bulk update user roles" });
    }
  }

  async removeUserRole(req, res) {
    try {
      const { userId, role } = req.body;
      const data = await roleService.removeUserRole(userId, role);
      return res.json(data);
    } catch (error) {
      console.error(error);
      if (error instanceof CustomError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: "Failed to remove user role" });
    }
  }
}

module.exports = RoleController;
