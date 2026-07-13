const ProductDiscountService = require("../services/ProductDiscountService");
const discountService = new ProductDiscountService();

function handle(res, error, fallback) {
  console.error(fallback, error);
  return res
    .status(error.statusCode || 500)
    .json({ success: false, error: error.message || "Server error. Please try again later." });
}

class ShopProductDiscountController {
  async createDiscount(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;
      const { code, discountPercentage, expiryDate, isActive, usageLimit } = req.body;

      const discount = await discountService.createDiscount(Number(productId), userId, {
        code,
        discountPercentage,
        expiryDate,
        isActive,
        usageLimit,
      });

      return res.status(201).json({ success: true, data: discount });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.createDiscount error:");
    }
  }

  async listDiscounts(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;

      const result = await discountService.listDiscounts(Number(productId), userId, { page, limit });
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.listDiscounts error:");
    }
  }

  async getDiscount(req, res) {
    try {
      const { discountId } = req.params;
      const { id: userId } = req.user;

      const discount = await discountService.getDiscount(Number(discountId), userId);
      return res.json({ success: true, data: discount });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.getDiscount error:");
    }
  }

  async updateDiscount(req, res) {
    try {
      const { discountId } = req.params;
      const { id: userId } = req.user;
      const { code, discountPercentage, expiryDate, isActive, usageLimit } = req.body;

      const discount = await discountService.updateDiscount(Number(discountId), userId, {
        code,
        discountPercentage,
        expiryDate,
        isActive,
        usageLimit,
      });

      return res.json({ success: true, data: discount });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.updateDiscount error:");
    }
  }

  async deleteDiscount(req, res) {
    try {
      const { discountId } = req.params;
      const { id: userId } = req.user;

      await discountService.deleteDiscount(Number(discountId), userId);
      return res.json({ success: true, message: "Discount deleted." });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.deleteDiscount error:");
    }
  }

  // Public — no auth
  async validateCode(req, res) {
    try {
      const { code } = req.query;
      const result = await discountService.validateCode(code);
      return res.json({ success: true, data: result });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.validateCode error:");
    }
  }

  async redeemCode(req, res) {
    try {
      const { code } = req.params;
      const { id: userId } = req.user;

      const result = await discountService.redeemCode(code, userId);
      return res.json({ success: true, message: "Discount redeemed.", data: result });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.redeemCode error:");
    }
  }

  // ── Automatic quantity rules ────────────────────────────────────────────

  async createRule(req, res) {
    try {
      const { productId } = req.params;
      const { id: userId } = req.user;
      const rule = await discountService.createRule(Number(productId), userId, req.body);
      return res.status(201).json({ success: true, data: rule });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.createRule error:");
    }
  }

  // Public — buyers see the tiers
  async listRules(req, res) {
    try {
      const { productId } = req.params;
      const rules = await discountService.listRules(Number(productId));
      return res.json({ success: true, data: rules });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.listRules error:");
    }
  }

  async updateRule(req, res) {
    try {
      const { ruleId } = req.params;
      const { id: userId } = req.user;
      const rule = await discountService.updateRule(Number(ruleId), userId, req.body);
      return res.json({ success: true, data: rule });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.updateRule error:");
    }
  }

  async deleteRule(req, res) {
    try {
      const { ruleId } = req.params;
      const { id: userId } = req.user;
      await discountService.deleteRule(Number(ruleId), userId);
      return res.json({ success: true, message: "Discount rule deleted." });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.deleteRule error:");
    }
  }

  // Public — single applied discount + final price for a quantity
  async previewPrice(req, res) {
    try {
      const { productId } = req.params;
      const { quantity, code, variationId } = req.query;
      const result = await discountService.previewPrice(Number(productId), {
        quantity,
        code,
        variationId,
      });
      return res.json({ success: true, data: result });
    } catch (error) {
      return handle(res, error, "ShopProductDiscountController.previewPrice error:");
    }
  }
}

module.exports = ShopProductDiscountController;
