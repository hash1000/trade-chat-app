const TemplateService = require("../services/TemplateService");
const templateService = new TemplateService();

function sendError(res, error, label) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, error: error.message });
  }
  console.error(`${label} error:`, error);
  return res.status(500).json({ success: false, error: "Server error. Please try again later." });
}

class TemplateController {
  async getTemplates(req, res) {
    try {
      const { id: userId } = req.user;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const templates = await templateService.list(userId, { search: search || undefined });
      return res.status(200).json({ success: true, data: templates });
    } catch (error) {
      return sendError(res, error, "getTemplates");
    }
  }

  async getTemplate(req, res) {
    try {
      const { id: userId } = req.user;
      const template = await templateService.get(userId, req.parsedParams.id);
      return res.status(200).json({ success: true, data: template });
    } catch (error) {
      return sendError(res, error, "getTemplate");
    }
  }

  async createTemplate(req, res) {
    try {
      const { id: userId } = req.user;
      const { title, subTitle } = req.body;
      const template = await templateService.create(userId, { title, subTitle });
      return res.status(201).json({
        success: true,
        message: "Template created successfully.",
        data: template,
      });
    } catch (error) {
      return sendError(res, error, "createTemplate");
    }
  }

  async updateTemplate(req, res) {
    try {
      const { id: userId } = req.user;
      const { title, subTitle } = req.body;
      const template = await templateService.update(userId, req.parsedParams.id, { title, subTitle });
      return res.status(200).json({
        success: true,
        message: "Template updated successfully.",
        data: template,
      });
    } catch (error) {
      return sendError(res, error, "updateTemplate");
    }
  }

  async deleteTemplate(req, res) {
    try {
      const { id: userId } = req.user;
      await templateService.remove(userId, req.parsedParams.id);
      return res.status(200).json({ success: true, message: "Template deleted successfully." });
    } catch (error) {
      return sendError(res, error, "deleteTemplate");
    }
  }

  async duplicateTemplate(req, res) {
    try {
      const { id: userId } = req.user;
      const template = await templateService.duplicate(userId, req.parsedParams.id);
      return res.status(201).json({
        success: true,
        message: "Template duplicated successfully.",
        data: template,
      });
    } catch (error) {
      return sendError(res, error, "duplicateTemplate");
    }
  }

  async reorderTemplates(req, res) {
    try {
      const { id: userId } = req.user;
      const templates = await templateService.reorder(userId, req.body.orderedIds);
      return res.status(200).json({
        success: true,
        message: "Templates reordered successfully.",
        data: templates,
      });
    } catch (error) {
      return sendError(res, error, "reorderTemplates");
    }
  }
}

module.exports = TemplateController;
