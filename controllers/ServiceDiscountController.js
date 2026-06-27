const ServiceDiscountService = require("../services/ServiceDiscountService");

const discountService = new ServiceDiscountService();

class ServiceDiscountController {
  /**
   * POST /services/:serviceId/discounts
   */
  async createDiscount(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);
      const { code, discountPercentage, expiryDate } = req.body;

      const discount = await discountService.createDiscount(serviceId, actorId, isAdmin, {
        code,
        discountPercentage,
        expiryDate,
      });

      return res.status(201).json({ success: true, data: discount });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.createDiscount");
    }
  }

  /**
   * GET /services/:serviceId/discounts
   */
  async listDiscounts(req, res) {
    try {
      const serviceId = Number(req.params.serviceId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);
      const includeUsed = req.query.includeUsed === "true";
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

      const result = await discountService.listDiscounts(serviceId, actorId, isAdmin, {
        includeUsed,
        page,
        limit,
      });

      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.listDiscounts");
    }
  }

  /**
   * GET /discounts/validate?code=xxx&serviceId=5
   */
  async validateCode(req, res) {
    try {
      const { code, serviceId } = req.query;

      if (!code || !serviceId) {
        return res.status(400).json({ success: false, error: "code and serviceId query parameters are required." });
      }

      const result = await discountService.validateCode(code, Number(serviceId));
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.validateCode");
    }
  }

  /**
   * POST /discounts/:code/redeem
   */
  async redeemCode(req, res) {
    try {
      const { code } = req.params;
      const { serviceId } = req.body;
      const userId = req.user.id;

      if (!serviceId) {
        return res.status(400).json({ success: false, error: "serviceId is required." });
      }

      const result = await discountService.redeemCode(code, Number(serviceId), userId);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.redeemCode");
    }
  }

  /**
   * GET /discounts/:discountId
   */
  async getDiscount(req, res) {
    try {
      const discountId = Number(req.params.discountId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);

      const discount = await discountService.getDiscount(discountId, actorId, isAdmin);
      return res.status(200).json({ success: true, data: discount });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.getDiscount");
    }
  }

  /**
   * PATCH /discounts/:discountId
   */
  async updateDiscount(req, res) {
    try {
      const discountId = Number(req.params.discountId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);
      const { isActive, expiryDate } = req.body;

      const parsedIsActive =
        isActive === true || isActive === "true"
          ? true
          : isActive === false || isActive === "false"
            ? false
            : undefined;

      const discount = await discountService.updateDiscount(discountId, actorId, isAdmin, {
        isActive: parsedIsActive,
        expiryDate,
      });
      return res.status(200).json({ success: true, data: discount });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.updateDiscount");
    }
  }

  /**
   * DELETE /discounts/:discountId
   */
  async deleteDiscount(req, res) {
    try {
      const discountId = Number(req.params.discountId);
      const actorId = req.user.id;
      const isAdmin = Boolean(req.user.isAdmin);

      await discountService.deleteDiscount(discountId, actorId, isAdmin);
      return res.status(200).json({ success: true, message: "Discount deleted successfully." });
    } catch (error) {
      return handleError(res, error, "ServiceDiscountController.deleteDiscount");
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
  if (statusCode === 500) {
    console.error(`${context} error:`, error);
  }
  const message = statusCode === 500 ? "Server error. Please try again later." : error.message;
  return res.status(statusCode).json({ success: false, error: message });
}

module.exports = ServiceDiscountController;
