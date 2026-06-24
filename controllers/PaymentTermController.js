const PaymentTermService = require("../services/PaymentTermService");

const termService = new PaymentTermService();

class PaymentTermController {
  /** POST /services/:serviceId/payment-terms */
  async createTerm(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);

      const term = await termService.createTerm(serviceId, actorId, isAdmin, req.body);
      return res.status(201).json({ success: true, data: term });
    } catch (error) {
      return handleError(res, error, "PaymentTermController.createTerm");
    }
  }

  /** GET /services/:serviceId/payment-terms */
  async listTerms(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user?.id;
      const isAdmin = Boolean(req.user?.isAdmin);
      const includeInactive = req.query.includeInactive === "true";

      const terms = await termService.listTerms(serviceId, actorId, isAdmin, { includeInactive });
      return res.status(200).json({ success: true, data: terms });
    } catch (error) {
      return handleError(res, error, "PaymentTermController.listTerms");
    }
  }

  /** GET /services/:serviceId/payment-terms/public */
  async listPublicTerms(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);

      const terms = await termService.listTerms(serviceId, null, false, { publicOnly: true });
      return res.status(200).json({ success: true, data: terms });
    } catch (error) {
      return handleError(res, error, "PaymentTermController.listPublicTerms");
    }
  }

  /** GET /services/:serviceId/payment-terms/:termId */
  async getTerm(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const termId = Number(req.params.termId);
      const actorId = req.user?.id;
      const isAdmin = Boolean(req.user?.isAdmin);

      const term = await termService.getTerm(serviceId, termId, actorId, isAdmin);
      return res.status(200).json({ success: true, data: term });
    } catch (error) {
      return handleError(res, error, "PaymentTermController.getTerm");
    }
  }

  /** PUT /services/:serviceId/payment-terms/:termId */
  async updateTerm(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const termId = Number(req.params.termId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);

      const term = await termService.updateTerm(serviceId, termId, actorId, isAdmin, req.body);
      return res.status(200).json({ success: true, data: term });
    } catch (error) {
      return handleError(res, error, "PaymentTermController.updateTerm");
    }
  }

  /** PATCH /services/:serviceId/payment-terms/:termId/set-default */
  async setDefault(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const termId = Number(req.params.termId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);

      const term = await termService.setDefault(serviceId, termId, actorId, isAdmin);
      return res.status(200).json({ success: true, data: term });
    } catch (error) {
      return handleError(res, error, "PaymentTermController.setDefault");
    }
  }

  /** DELETE /services/:serviceId/payment-terms/:termId */
  async deleteTerm(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const termId = Number(req.params.termId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);

      await termService.deleteTerm(serviceId, termId, actorId, isAdmin);
      return res.status(204).send();
    } catch (error) {
      return handleError(res, error, "PaymentTermController.deleteTerm");
    }
  }
}

function handleError(res, error, context) {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Server error. Please try again later." : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = PaymentTermController;
