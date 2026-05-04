const ServiceService = require("../services/ServiceService");
const serviceService = new ServiceService();

class ServiceController {
  async list(req, res) {
    try {
      const includeTeams = req.query.includeTeams === "true";
      const includeMembers = req.query.includeMembers === "true";
      const includeCategories = req.query.includeCategories === "true";
      const services = await serviceService.getAll({ includeTeams, includeMembers, includeCategories });
      return res.status(200).json({ success: true, data: services });
    } catch (error) {
      console.error("ServiceController.list error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const includeTeams = req.query.includeTeams !== "false";
      const includeMembers = req.query.includeMembers === "true";
      const includeCategories = req.query.includeCategories !== "false";
      const service = await serviceService.getById(id, { includeTeams, includeMembers, includeCategories });
      if (!service) {
        return res.status(404).json({ success: false, error: "Service not found." });
      }
      return res.status(200).json({ success: true, data: service });
    } catch (error) {
      console.error("ServiceController.getById error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async create(req, res) {
    try {
      const { name, profile_image, type, description, location, teamIds, categoryId, categoryIds } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, error: "name is required." });
      }
      if (!profile_image || typeof profile_image !== "string" || !profile_image.trim()) {
        return res.status(400).json({ success: false, error: "profile_image is required." });
      }

      const service = await serviceService.create({
        name: name.trim(),
        profile_image: profile_image.trim(),
        type: type ? type.trim() : undefined,
        description: description ? description.trim() : undefined,
        location: location ? location.trim() : undefined,
      });

      if (Array.isArray(teamIds) && teamIds.length > 0) {
        await serviceService.addTeams(service.id, teamIds);
      }
      const categoriesToAssign = Array.isArray(categoryIds)
        ? categoryIds
        : categoryId != null
          ? [categoryId]
          : [];
      if (categoriesToAssign.length > 0) {
        await serviceService.addCategories(service.id, categoriesToAssign);
      }

      const data = await serviceService.getById(service.id, { includeTeams: true, includeMembers: true, includeCategories: true });
      return res.status(201).json({ success: true, data });
    } catch (error) {
      console.error("ServiceController.create error:", error);
      if (error.name === "InvalidTeamIdError" || error.name === "InvalidCategoryIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, profile_image, type, description, location, teamIds, categoryId, categoryIds } = req.body;
      const service = await serviceService.getById(id);
      if (!service) {
        return res.status(404).json({ success: false, error: "Service not found." });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : name;
      if (profile_image !== undefined) updateData.profile_image = typeof profile_image === "string" ? profile_image.trim() : profile_image;
      if (type !== undefined) updateData.type = typeof type === "string" ? type.trim() : type;
      if (description !== undefined) updateData.description = typeof description === "string" ? description.trim() : description;
      if (location !== undefined) updateData.location = typeof location === "string" ? location.trim() : location;

      await serviceService.update(id, updateData);
      if (teamIds !== undefined) {
        await serviceService.setTeams(id, Array.isArray(teamIds) ? teamIds : []);
      }
      if (categoryIds !== undefined || categoryId !== undefined) {
        const categoriesToAssign = Array.isArray(categoryIds)
          ? categoryIds
          : categoryId != null
            ? [categoryId]
            : [];
        await serviceService.setCategories(id, categoriesToAssign);
      }

      const data = await serviceService.getById(id, { includeTeams: true, includeMembers: true, includeCategories: true });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("ServiceController.update error:", error);
      if (error.name === "InvalidTeamIdError" || error.name === "InvalidCategoryIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const service = await serviceService.getById(id);
      if (!service) {
        return res.status(404).json({ success: false, error: "Service not found." });
      }
      await serviceService.delete(id);
      return res.status(200).json({ success: true, message: "Service deleted." });
    } catch (error) {
      console.error("ServiceController.delete error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async addTeam(req, res) {
    try {
      const { id: serviceId } = req.params;
      const { teamId: singleTeamId, teamIds } = req.body;
      const service = await serviceService.getById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, error: "Service not found." });
      }
      if (Array.isArray(teamIds) && teamIds.length > 0) {
        await serviceService.addTeams(Number(serviceId), teamIds);
      } else if (singleTeamId != null) {
        await serviceService.addTeam(Number(serviceId), Number(singleTeamId));
      } else {
        return res.status(400).json({ success: false, error: "teamId or teamIds (array) is required." });
      }

      const updated = await serviceService.getById(serviceId, { includeTeams: true, includeMembers: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.addTeam error:", error);
      if (error.name === "InvalidTeamIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async removeTeam(req, res) {
    try {
      const { id: serviceId, teamId } = req.params;
      const removed = await serviceService.removeTeam(Number(serviceId), Number(teamId));
      if (!removed) {
        return res.status(404).json({ success: false, error: "Team not found in service." });
      }

      const updated = await serviceService.getById(serviceId, { includeTeams: true, includeMembers: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.removeTeam error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async addCategory(req, res) {
    try {
      const { id: serviceId } = req.params;
      const { categoryId: singleCategoryId, categoryIds } = req.body;
      const service = await serviceService.getById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, error: "Service not found." });
      }
      if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        await serviceService.addCategories(Number(serviceId), categoryIds);
      } else if (singleCategoryId != null) {
        await serviceService.addCategory(Number(serviceId), Number(singleCategoryId));
      } else {
        return res.status(400).json({ success: false, error: "categoryId or categoryIds (array) is required." });
      }

      const updated = await serviceService.getById(serviceId, { includeTeams: true, includeMembers: true, includeCategories: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.addCategory error:", error);
      if (error.name === "InvalidCategoryIdError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async removeCategory(req, res) {
    try {
      const { id: serviceId, categoryId } = req.params;
      const removed = await serviceService.removeCategory(Number(serviceId), Number(categoryId));
      if (!removed) {
        return res.status(404).json({ success: false, error: "Category not found in service." });
      }

      const updated = await serviceService.getById(serviceId, { includeTeams: true, includeMembers: true, includeCategories: true });
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("ServiceController.removeCategory error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = ServiceController;
