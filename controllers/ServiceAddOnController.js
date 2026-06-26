const ServiceAddOnService = require("../services/ServiceAddOnService");

const serviceAddOnService = new ServiceAddOnService();

class ServiceAddOnController {
  async listAddOns(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

      const result = await serviceAddOnService.listAddOns(serviceId, { page, limit });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async getAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);

      const addOn = await serviceAddOnService.getAddOn(serviceId, addOnId);

      return res.status(200).json({ success: true, data: addOn });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async createAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const { title, description, amount } = req.body;

      const addOn = await serviceAddOnService.createAddOn(serviceId, actorId, { title, description, amount });

      return res.status(201).json({ success: true, data: addOn });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async updateAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);
      const actorId = req.user.id;
      const { title, description, amount } = req.body;

      const addOn = await serviceAddOnService.updateAddOn(serviceId, addOnId, actorId, { title, description, amount });

      return res.status(200).json({ success: true, data: addOn });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async deleteAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);
      const actorId = req.user.id;

      const result = await serviceAddOnService.deleteAddOn(serviceId, addOnId, actorId);

      return res.status(200).json({ success: true, message: "Add-on deleted successfully.", data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // POST /services/:serviceId/add-ons/:addOnId/media
  async uploadMedia(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);
      const actorId = req.user.id;
      console.log("ServiceAddOnController.uploadMedia req.files:", req.files);
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, error: "No files uploaded." });
      }

      const files = await serviceAddOnService.uploadMedia(serviceId, addOnId, actorId, req.files);

      return res.status(201).json({ success: true, data: files });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // DELETE /services/:serviceId/add-ons/:addOnId/media/:fileId
  async deleteFile(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);
      const fileId = Number(req.params.fileId);
      const actorId = req.user.id;

      await serviceAddOnService.deleteFile(serviceId, addOnId, fileId, actorId);

      return res.status(200).json({ success: true, message: "File deleted successfully." });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

function handleError(res, error) {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Server error. Please try again later." : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = ServiceAddOnController;
