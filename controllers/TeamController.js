const { Op } = require("sequelize");
const TeamService = require("../services/TeamService");
const UserService = require("../services/UserService");
const teamService = new TeamService();
const userService = new UserService();

async function isAdminUser(userId) {
  try {
    const user = await userService.getUserById(userId);
    return !!(user && user.roles && user.roles.some((r) => r.name === "admin"));
  } catch {
    return false;
  }
}

// Shop teams are private to their creator — no admin override.
// Service teams allow admin involvement.
// Legacy teams (createdBy null, pre-ownership) stay open.
async function cannotManage(team, userId) {
  if (team.createdBy === null) return false;
  if (team.createdBy === userId) return false;
  if (team.type !== "shop" && (await isAdminUser(userId))) return false;
  return true;
}

class TeamController {
  async list(req, res) {
    try {
      const { id: userId } = req.user;
      const includeMembers = req.query.includeMembers === "true";
      const includeServices = req.query.includeServices === "true";
      const typeFilter = req.query.type;

      // Own teams only; admins additionally see every service team.
      // Other users' shop teams are never visible.
      const admin = await isAdminUser(userId);
      const where = admin
        ? { [Op.or]: [{ createdBy: userId }, { type: "service" }] }
        : { createdBy: userId };
      if (typeFilter === "shop" || typeFilter === "service") {
        where.type = typeFilter;
      }

      const teams = await teamService.getAll({
        includeMembers,
        includeServices,
        where,
      });
      return res.status(200).json({ success: true, data: teams });
    } catch (error) {
      console.error("TeamController.list error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const includeMembers = req.query.includeMembers !== "false";
      const includeServices = req.query.includeServices !== "false";
      const team = await teamService.getById(id, { includeMembers, includeServices });
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      return res.status(200).json({ success: true, data: team });
    } catch (error) {
      console.error("TeamController.getById error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async create(req, res) {
    try {
      const { name, type, profile_image, description, userIds, serviceIds } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, error: "name is required." });
      }
      if (!profile_image || typeof profile_image !== "string" || !profile_image.trim()) {
        return res.status(400).json({ success: false, error: "profile_image is required." });
      }
      const teamType = typeof type === "string" && type.trim() === "shop" ? "shop" : "service";
      const team = await teamService.create({
        name: name.trim(),
        type: teamType,
        profile_image: profile_image.trim(),
        description: description ? description.trim() : undefined,
        createdBy: req.user.id,
      });
      if (Array.isArray(userIds) && userIds.length > 0) {
        await teamService.addMembers(team.id, userIds);
      }
      if (Array.isArray(serviceIds) && serviceIds.length > 0) {
        await teamService.addServices(team.id, serviceIds);
      }
      const data = await teamService.getById(team.id, { includeMembers: true, includeServices: true });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      console.error("TeamController.create error:", error);
      if (error.name === "InvalidUserIdError" || error.name === "InvalidServiceIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, type, profile_image, description, userIds, serviceIds } = req.body;
      const team = await teamService.getById(id);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      if (await cannotManage(team, req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden. You cannot update this team." });
      }
      const updateData = {};
      if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : name;
      // type is fixed at creation — shop and service teams must stay separate
      if (profile_image !== undefined) updateData.profile_image = typeof profile_image === "string" ? profile_image.trim() : profile_image;
      if (description !== undefined) updateData.description = typeof description === "string" ? description.trim() : description;
      await teamService.update(id, updateData);
      if (userIds !== undefined) {
        await teamService.setMembers(id, Array.isArray(userIds) ? userIds : []);
      }
      if (serviceIds !== undefined) {
        await teamService.setServices(id, Array.isArray(serviceIds) ? serviceIds : []);
      }
      const data = await teamService.getById(id, { includeMembers: true, includeServices: true });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("TeamController.update error:", error);
      if (error.name === "InvalidUserIdError" || error.name === "InvalidServiceIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "SequelizeForeignKeyConstraintError") {
        return res.status(400).json({ success: false, error: "One or more related IDs do not exist." });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const team = await teamService.getById(id);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      if (await cannotManage(team, req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden. You cannot delete this team." });
      }
      await teamService.delete(id);
      return res.status(200).json({ success: true, message: "Team deleted." });
    } catch (error) {
      console.error("TeamController.delete error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async addMember(req, res) {
    try {
      const { id: teamId } = req.params;
      const { userId: singleUserId, userIds } = req.body;
      const team = await teamService.getById(teamId);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      if (await cannotManage(team, req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden. You cannot manage this team's members." });
      }
      if (Array.isArray(userIds) && userIds.length > 0) {
        await teamService.addMembers(Number(teamId), userIds);
      } else if (singleUserId != null) {
        await teamService.addMember(Number(teamId), Number(singleUserId));
      } else {
        return res.status(400).json({ success: false, error: "userId or userIds (array) is required." });
      }
      const updated = await teamService.getById(teamId, { includeMembers: true, includeServices: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.addMember error:", error);
      if (error.name === "InvalidUserIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "SequelizeForeignKeyConstraintError") {
        return res.status(400).json({ success: false, error: "One or more user IDs do not exist." });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async removeMember(req, res) {
    try {
      const { id: teamId, userId: targetUserId } = req.params;
      if (!targetUserId) {
        return res.status(400).json({ success: false, error: "userId is required." });
      }
      const team = await teamService.getById(teamId);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      if (await cannotManage(team, req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden. You cannot manage this team's members." });
      }
      const removed = await teamService.removeMember(Number(teamId), Number(targetUserId));
      if (!removed) {
        return res.status(404).json({ success: false, error: "Member not found in team." });
      }
      const updated = await teamService.getById(teamId, { includeMembers: true, includeServices: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.removeMember error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async addService(req, res) {
    try {
      const { id: teamId } = req.params;
      const { serviceId: singleServiceId, serviceIds } = req.body;
      const team = await teamService.getById(teamId);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      if (team.type === "shop") {
        return res.status(400).json({ success: false, error: "Shop teams cannot be assigned to services." });
      }
      if (await cannotManage(team, req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden. You cannot manage this team's services." });
      }
      if (Array.isArray(serviceIds) && serviceIds.length > 0) {
        await teamService.addServices(Number(teamId), serviceIds);
      } else if (singleServiceId != null) {
        await teamService.addService(Number(teamId), Number(singleServiceId));
      } else {
        return res.status(400).json({ success: false, error: "serviceId or serviceIds (array) is required." });
      }
      const updated = await teamService.getById(teamId, { includeMembers: true, includeServices: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.addService error:", error);
      if (error.name === "InvalidServiceIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async removeService(req, res) {
    try {
      const { id: teamId, serviceId } = req.params;
      if (!serviceId) {
        return res.status(400).json({ success: false, error: "serviceId is required." });
      }
      const team = await teamService.getById(teamId);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      if (await cannotManage(team, req.user.id)) {
        return res.status(403).json({ success: false, error: "Forbidden. You cannot manage this team's services." });
      }
      const removed = await teamService.removeService(Number(teamId), Number(serviceId));
      if (!removed) {
        return res.status(404).json({ success: false, error: "Service not found in team." });
      }
      const updated = await teamService.getById(teamId, { includeMembers: true, includeServices: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.removeService error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async myTeams(req, res) {
    try {
      const { id: userId } = req.user;
      const teams = await teamService.getTeamsForUser(userId);
      return res.status(200).json({ success: true, data: teams });
    } catch (error) {
      console.error("TeamController.myTeams error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = TeamController;
