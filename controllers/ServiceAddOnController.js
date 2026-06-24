const ServiceAddOnService = require("../services/ServiceAddOnService");

const serviceAddOnService = new ServiceAddOnService();

class ServiceAddOnController {
  /**
   * GET /services/:serviceId/add-ons
   * List add-ons with pagination. Excludes soft-deleted by default.
   */
  async listAddOns(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const includeInactive = req.query.includeInactive === "true";

      const result = await serviceAddOnService.listAddOns(serviceId, { page, limit, includeInactive });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnController.listAddOns");
    }
  }

  /**
   * GET /services/:serviceId/add-ons/:addOnId
   * Get a single add-on with its files.
   */
  async getAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);

      const addOn = await serviceAddOnService.getAddOn(serviceId, addOnId);

      return res.status(200).json({ success: true, data: addOn });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnController.getAddOn");
    }
  }

  /**
   * POST /services/:serviceId/add-ons
   * Create a new add-on. Only service owner.
   */
  async createAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const { title, description, amount } = req.body;

      const addOn = await serviceAddOnService.createAddOn(serviceId, actorId, {
        title,
        description,
        amount,
      });

      return res.status(201).json({ success: true, data: addOn });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnController.createAddOn");
    }
  }

  /**
   * PUT /services/:serviceId/add-ons/:addOnId
   * Update an add-on. Only service owner.
   */
  async updateAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);
      const actorId = req.user.id;
      const { title, description, amount } = req.body;

      const addOn = await serviceAddOnService.updateAddOn(serviceId, addOnId, actorId, {
        title,
        description,
        amount,
      });

      return res.status(200).json({ success: true, data: addOn });
    } catch (error) {
      return handleError(res, error, "ServiceAddOnController.updateAddOn");
    }
  }

  /**
   * DELETE /services/:serviceId/add-ons/:addOnId
   * Soft-delete an add-on. Only service owner.
   */
  async deleteAddOn(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const addOnId = Number(req.params.addOnId);
      const actorId = req.user.id;

      await serviceAddOnService.deleteAddOn(serviceId, addOnId, actorId);

      return res.status(204).send();
    } catch (error) {
      return handleError(res, error, "ServiceAddOnController.deleteAddOn");
    }
  }
}

/**
 * @param {import('express').Response} res
 * @param {Error & { statusCode?: number }} error
 * @param {string} context
 */
function handleError(res, error, context) {
  const statusCode = error.statusCode || 500;
  const message =
    statusCode === 500 ? "Server error. Please try again later." : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = ServiceAddOnController;
