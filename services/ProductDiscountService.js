const { Op } = require("sequelize");
const { ShopProduct, ProductDiscountCode, ProductDiscount, ProductVariation, Shop, User } = require("../models");

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

class ProductDiscountService {
  async assertProductExists(productId) {
    const product = await ShopProduct.findByPk(productId);
    if (!product) throw httpError("Product not found.", 404);
    return product;
  }

  async assertOwner(product, userId) {
    const shop = await Shop.findByPk(product.shopId);
    if (!shop || shop.userId !== userId) {
      throw httpError("Forbidden. Only the shop owner can manage product discounts.", 403);
    }
  }

  normalizeCode(code) {
    if (typeof code !== "string" || !code.trim()) {
      throw httpError("code is required.", 422);
    }
    const normalized = code.trim().toUpperCase();
    if (normalized.length > 50) {
      throw httpError("code may not exceed 50 characters.", 422);
    }
    return normalized;
  }

  validatePercentage(value) {
    const pct = Number(value);
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
      throw httpError("discountPercentage must be a number between 0.01 and 100.", 422);
    }
    return pct;
  }

  async createDiscount(productId, actorId, { code, discountPercentage, expiryDate, isActive, usageLimit }) {
    const product = await this.assertProductExists(productId);
    await this.assertOwner(product, actorId);

    const normalizedCode = this.normalizeCode(code);
    const pct = this.validatePercentage(discountPercentage);

    const existing = await ProductDiscountCode.findOne({ where: { code: normalizedCode } });
    if (existing) throw httpError("Discount code already exists.", 409);

    let limit = null;
    if (usageLimit !== undefined && usageLimit !== null) {
      limit = Number(usageLimit);
      if (!Number.isInteger(limit) || limit < 1) {
        throw httpError("usageLimit must be a positive integer (or null for unlimited).", 422);
      }
    }

    return ProductDiscountCode.create({
      shopProductId: productId,
      code: normalizedCode,
      discountPercentage: pct,
      expiryDate: expiryDate ?? null,
      isActive: isActive !== undefined ? !!isActive : true,
      usageLimit: limit,
      createdBy: actorId,
    });
  }

  async listDiscounts(productId, actorId, { page = 1, limit = 10 } = {}) {
    const product = await this.assertProductExists(productId);
    await this.assertOwner(product, actorId);

    const offset = (page - 1) * limit;
    const { count, rows } = await ProductDiscountCode.findAndCountAll({
      where: { shopProductId: productId },
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return {
      data: rows,
      pagination: { page, limit, total: count, pages: Math.ceil(count / limit) },
    };
  }

  async getDiscount(discountId, actorId) {
    const discount = await ProductDiscountCode.findByPk(discountId, {
      include: [{ model: User, as: "redeemer", attributes: ["id", "username", "email"] }],
    });
    if (!discount) throw httpError("Discount not found.", 404);

    const product = await this.assertProductExists(discount.shopProductId);
    await this.assertOwner(product, actorId);

    return discount;
  }

  async updateDiscount(discountId, actorId, { code, discountPercentage, expiryDate, isActive, usageLimit }) {
    const discount = await ProductDiscountCode.findByPk(discountId);
    if (!discount) throw httpError("Discount not found.", 404);

    const product = await this.assertProductExists(discount.shopProductId);
    await this.assertOwner(product, actorId);

    const updateData = {};
    if (usageLimit !== undefined) {
      if (usageLimit === null) {
        updateData.usageLimit = null;
      } else {
        const limit = Number(usageLimit);
        if (!Number.isInteger(limit) || limit < 1) {
          throw httpError("usageLimit must be a positive integer (or null for unlimited).", 422);
        }
        if (limit < discount.usedCount) {
          throw httpError(`usageLimit cannot be lower than usedCount (${discount.usedCount}).`, 422);
        }
        updateData.usageLimit = limit;
      }
    }
    if (code !== undefined) {
      const normalizedCode = this.normalizeCode(code);
      const clash = await ProductDiscountCode.findOne({
        where: { code: normalizedCode, id: { [Op.ne]: discount.id } },
      });
      if (clash) throw httpError("Discount code already exists.", 409);
      updateData.code = normalizedCode;
    }
    if (discountPercentage !== undefined) {
      updateData.discountPercentage = this.validatePercentage(discountPercentage);
    }
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate;
    if (isActive !== undefined) updateData.isActive = !!isActive;

    await discount.update(updateData);
    return discount;
  }

  async deleteDiscount(discountId, actorId) {
    const discount = await ProductDiscountCode.findByPk(discountId);
    if (!discount) throw httpError("Discount not found.", 404);

    const product = await this.assertProductExists(discount.shopProductId);
    await this.assertOwner(product, actorId);

    await discount.destroy();
    return true;
  }

  // Public — no auth. Valid while usedCount < usageLimit (null = unlimited ∞).
  async validateCode(code) {
    const normalizedCode = this.normalizeCode(code);
    const discount = await ProductDiscountCode.findOne({ where: { code: normalizedCode } });

    if (!discount) return { valid: false, reason: "Code not found." };
    if (!discount.isActive) return { valid: false, reason: "Code is inactive." };
    if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
      return { valid: false, reason: "Code usage limit reached." };
    }
    if (discount.expiryDate && new Date(discount.expiryDate) < new Date()) {
      return { valid: false, reason: "Code has expired." };
    }

    return {
      valid: true,
      code: discount.code,
      discountPercentage: discount.discountPercentage,
      shopProductId: discount.shopProductId,
      usageLimit: discount.usageLimit,
      usedCount: discount.usedCount,
      expiryDate: discount.expiryDate,
    };
  }

  async redeemCode(code, userId) {
    const result = await this.validateCode(code);
    if (!result.valid) throw httpError(result.reason, 400);

    const discount = await ProductDiscountCode.findOne({ where: { code: result.code } });
    const newCount = discount.usedCount + 1;
    await discount.update({
      usedCount: newCount,
      usedBy: userId,
      usedAt: new Date(),
      isUsed: discount.usageLimit !== null && newCount >= discount.usageLimit,
    });

    return {
      code: discount.code,
      discountPercentage: discount.discountPercentage,
      shopProductId: discount.shopProductId,
      usedCount: newCount,
      usageLimit: discount.usageLimit,
    };
  }

  // ── Automatic quantity rules ("Buy 3+ → -5%") ────────────────────────────

  validateRulePayload({ name, minQuantity, discountPercent }, partial = false) {
    const data = {};
    if (!partial || name !== undefined) {
      if (typeof name !== "string" || !name.trim()) throw httpError("name is required.", 422);
      data.name = name.trim();
    }
    if (!partial || minQuantity !== undefined) {
      const qty = Number(minQuantity);
      if (!Number.isInteger(qty) || qty < 1) throw httpError("minQuantity must be an integer >= 1.", 422);
      data.minQuantity = qty;
    }
    if (!partial || discountPercent !== undefined) {
      const pct = Number(discountPercent);
      if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
        throw httpError("discountPercent must be a number between 0.01 and 100.", 422);
      }
      data.discountPercent = pct;
    }
    return data;
  }

  async createRule(productId, actorId, payload) {
    const product = await this.assertProductExists(productId);
    await this.assertOwner(product, actorId);

    const data = this.validateRulePayload(payload);

    const clash = await ProductDiscount.findOne({
      where: { shopProductId: productId, minQuantity: data.minQuantity },
    });
    if (clash) throw httpError(`A rule for minQuantity ${data.minQuantity} already exists.`, 409);

    return ProductDiscount.create({ ...data, shopProductId: productId });
  }

  // Public — buyers see the tiers on the product page
  async listRules(productId) {
    await this.assertProductExists(productId);
    return ProductDiscount.findAll({
      where: { shopProductId: productId },
      order: [["minQuantity", "ASC"]],
    });
  }

  async updateRule(ruleId, actorId, payload) {
    const rule = await ProductDiscount.findByPk(ruleId);
    if (!rule) throw httpError("Discount rule not found.", 404);

    const product = await this.assertProductExists(rule.shopProductId);
    await this.assertOwner(product, actorId);

    const data = this.validateRulePayload(payload, true);

    if (data.minQuantity !== undefined) {
      const clash = await ProductDiscount.findOne({
        where: {
          shopProductId: rule.shopProductId,
          minQuantity: data.minQuantity,
          id: { [Op.ne]: rule.id },
        },
      });
      if (clash) throw httpError(`A rule for minQuantity ${data.minQuantity} already exists.`, 409);
    }

    await rule.update(data);
    return rule;
  }

  async deleteRule(ruleId, actorId) {
    const rule = await ProductDiscount.findByPk(ruleId);
    if (!rule) throw httpError("Discount rule not found.", 404);

    const product = await this.assertProductExists(rule.shopProductId);
    await this.assertOwner(product, actorId);

    await rule.destroy();
    return true;
  }

  // ── Price preview: exactly ONE discount applies ──────────────────────────
  // A valid manual code wins; otherwise the best satisfied quantity rule
  // (the one with the highest minQuantity <= quantity).
  async previewPrice(productId, { quantity, code, variationId }) {
    const product = await this.assertProductExists(productId);

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw httpError("quantity must be an integer >= 1.", 422);
    }

    let unitPrice = Number(product.price);
    let variation = null;
    if (variationId !== undefined && variationId !== null && variationId !== "") {
      variation = await ProductVariation.findOne({
        where: { id: Number(variationId), shopProductId: productId },
      });
      if (!variation) throw httpError("Variation not found for this product.", 404);
      unitPrice = Number(variation.price);
    }

    let applied = null;

    if (code) {
      const codeResult = await this.validateCode(code);
      if (codeResult.valid && codeResult.shopProductId === product.id) {
        applied = {
          type: "code",
          code: codeResult.code,
          discountPercent: Number(codeResult.discountPercentage),
        };
      }
    }

    if (!applied) {
      const rules = await ProductDiscount.findAll({
        where: { shopProductId: productId, minQuantity: { [Op.lte]: qty } },
        order: [["minQuantity", "DESC"]],
        limit: 1,
      });
      if (rules.length > 0) {
        applied = {
          type: "quantity_rule",
          ruleId: rules[0].id,
          name: rules[0].name,
          minQuantity: rules[0].minQuantity,
          discountPercent: Number(rules[0].discountPercent),
        };
      }
    }

    const discountPercent = applied ? applied.discountPercent : 0;
    const subtotal = unitPrice * qty;
    const discountAmount = parseFloat(((subtotal * discountPercent) / 100).toFixed(2));
    const total = parseFloat((subtotal - discountAmount).toFixed(2));

    return {
      productId: product.id,
      variationId: variation ? variation.id : null,
      quantity: qty,
      unitPrice,
      subtotal,
      appliedDiscount: applied,
      discountPercent,
      discountAmount,
      total,
    };
  }
}

module.exports = ProductDiscountService;
