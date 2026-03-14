const TeamService = require("../services/TeamService");
const teamService = new TeamService();

class TeamController {
  async list(req, res) {
    try {
      const includeMembers = req.query.includeMembers === "true";
      const teams = await teamService.getAll({ includeMembers });
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
      const team = await teamService.getById(id, { includeMembers });
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
      const { name, type, description } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, error: "name is required." });
      }
      const team = await teamService.create({ name: name.trim(), type: type || null, description: description || null });
      return res.status(201).json({ success: true, data: team });
    } catch (error) {
      console.error("TeamController.create error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, type, description } = req.body;
      const team = await teamService.getById(id);
      if (!team) {
        return res.status(404).json({ success: false, error: "Team not found." });
      }
      const updateData = {};
      if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : name;
      if (type !== undefined) updateData.type = type;
      if (description !== undefined) updateData.description = description;
      const updated = await teamService.update(id, updateData);
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.update error:", error);
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

      if (Array.isArray(userIds) && userIds.length > 0) {
        await teamService.addMembers(Number(teamId), userIds);
      } else if (singleUserId != null) {
        await teamService.addMember(Number(teamId), Number(singleUserId));
      } else {
        return res.status(400).json({ success: false, error: "userId or userIds (array) is required." });
      }

      const updated = await teamService.getById(teamId, { includeMembers: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.addMember error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async removeMember(req, res) {
    try {
      const { id: teamId, userId: targetUserId } = req.params;
      if (!targetUserId) {
        return res.status(400).json({ success: false, error: "userId is required." });
      }
      const removed = await teamService.removeMember(Number(teamId), Number(targetUserId));
      if (!removed) {
        return res.status(404).json({ success: false, error: "Member not found in team." });
      }
      const updated = await teamService.getById(teamId, { includeMembers: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("TeamController.removeMember error:", error);
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
