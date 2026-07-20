const { Op } = require("sequelize");
const { ProductDiscount, ProductDiscountCode } = require("../models");
const ProductCartRepository = require("../repositories/ProductCartRepository");
const CustomError = require("../errors/CustomError");

function round2(n) {
  return parseFloat(Number(n).toFixed(2));
}

class ProductCartService {
  constructor() {
    this.repo = new ProductCartRepository();
  }

  // ── Shared resolution: product/variation existence, price source, stock ────

  async _resolveSource(shopProductId, variationId) {
    const product = await this.repo.fetchProduct(shopProductId);
    if (!product) throw new CustomError("Product not found", 404);

    if (product.hasVariations) {
      if (variationId === undefined || variationId === null || variationId === "") {
        throw new CustomError("variationId is required for this product", 422);
      }
      const variation = await this.repo.fetchVariation(Number(variationId), shopProductId);
      if (!variation) throw new CustomError("Variation not found for this product", 404);

      return {
        product,
        variation,
        unitPrice: Number(variation.price),
        availableStock: Number(variation.stock),
      };
    }

    if (variationId !== undefined && variationId !== null && variationId !== "") {
      throw new CustomError("This product does not use variations", 422);
    }

    return {
      product,
      variation: null,
      unitPrice: Number(product.price),
      availableStock: Number(product.quantity),
    };
  }

  _assertStock(availableStock, requestedQuantity) {
    if (requestedQuantity > availableStock) {
      throw new CustomError(
        `Only ${availableStock} unit(s) available`,
        400
      );
    }
  }

  // Exactly one discount applies: a valid code wins, else the best-satisfied
  // quantity tier. Mirrors ProductDiscountService.previewPrice's selection logic.
  async _resolveDiscount(shopProductId, quantity, code) {
    if (code) {
      const normalized = String(code).trim().toUpperCase();
      const discount = await ProductDiscountCode.findOne({ where: { code: normalized } });

      if (discount && discount.shopProductId === shopProductId) {
        const usageOk = discount.usageLimit === null || discount.usedCount < discount.usageLimit;
        const notExpired = !discount.expiryDate || new Date(discount.expiryDate) >= new Date();

        if (discount.isActive && usageOk && notExpired) {
          return {
            discountCode: discount.code,
            discountPercent: Number(discount.discountPercentage),
          };
        }
      }
      throw new CustomError("Discount code is invalid or not applicable to this product", 400);
    }

    const rules = await ProductDiscount.findAll({
      where: { shopProductId, minQuantity: { [Op.lte]: quantity } },
      order: [["minQuantity", "DESC"]],
      limit: 1,
    });

    if (rules.length > 0) {
      return { discountCode: null, discountPercent: Number(rules[0].discountPercent) };
    }

    return { discountCode: null, discountPercent: 0 };
  }

  _computeDiscountAmount(unitPrice, quantity, discountPercent) {
    return round2((unitPrice * quantity * discountPercent) / 100);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async addToCart(userId, { shopProductId, variationId, quantity, code }) {
    const qty = quantity === undefined ? 1 : Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new CustomError("quantity must be an integer >= 1", 422);
    }

    const { unitPrice, availableStock } = await this._resolveSource(
      Number(shopProductId),
      variationId
    );

    const existing = await this.repo.findExistingLine(userId, Number(shopProductId), variationId ?? null);
    const newQuantity = existing ? existing.quantity + qty : qty;
    this._assertStock(availableStock, newQuantity);

    const discount = await this._resolveDiscount(Number(shopProductId), newQuantity, code);
    const discountAmount = this._computeDiscountAmount(unitPrice, newQuantity, discount.discountPercent);

    if (existing) {
      await this.repo.saveLine(existing, {
        quantity: newQuantity,
        unitPriceSnapshot: unitPrice,
        discountCode: discount.discountCode,
        discountPercent: discount.discountPercent,
        discountAmount,
      });
      return { message: "Quantity increased", cartItem: existing };
    }

    const created = await this.repo.createLine({
      userId,
      shopProductId: Number(shopProductId),
      variationId: variationId ? Number(variationId) : null,
      quantity: qty,
      unitPriceSnapshot: unitPrice,
      discountCode: discount.discountCode,
      discountPercent: discount.discountPercent,
      discountAmount,
    });
    return { message: "Product added to cart", cartItem: created };
  }

  async updateQuantity(userId, cartItemId, quantity) {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      throw new CustomError("quantity must be an integer >= 0", 422);
    }

    const line = await this.repo.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);

    if (qty === 0) {
      await line.destroy();
      return { message: "Item removed from cart" };
    }

    const { unitPrice, availableStock } = await this._resolveSource(
      line.shopProductId,
      line.variationId
    );
    this._assertStock(availableStock, qty);

    // Re-evaluate the applied discount for the new quantity. A previously applied
    // code that has since expired/deactivated should not block a quantity change —
    // fall back to the best available quantity-tier rule instead of throwing.
    let discount;
    try {
      discount = await this._resolveDiscount(line.shopProductId, qty, line.discountCode);
    } catch (e) {
      discount = await this._resolveDiscount(line.shopProductId, qty, null);
      discount.discountCode = null;
    }
    const discountAmount = this._computeDiscountAmount(unitPrice, qty, discount.discountPercent);

    await this.repo.saveLine(line, {
      quantity: qty,
      unitPriceSnapshot: unitPrice,
      discountCode: discount.discountCode,
      discountPercent: discount.discountPercent,
      discountAmount,
    });
    return { message: "Quantity updated", cartItem: line };
  }

  async applyDiscountCode(userId, cartItemId, code) {
    if (!code || !String(code).trim()) {
      throw new CustomError("code is required", 422);
    }

    const line = await this.repo.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);

    const discount = await this._resolveDiscount(line.shopProductId, line.quantity, code);
    const discountAmount = this._computeDiscountAmount(
      Number(line.unitPriceSnapshot),
      line.quantity,
      discount.discountPercent
    );

    await this.repo.saveLine(line, {
      discountCode: discount.discountCode,
      discountPercent: discount.discountPercent,
      discountAmount,
    });
    return { message: "Discount applied", cartItem: line };
  }

  async removeDiscountCode(userId, cartItemId) {
    const line = await this.repo.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);

    // Falling back to code=null re-evaluates the automatic quantity-tier rules
    // rather than leaving the line with zero discount.
    const discount = await this._resolveDiscount(line.shopProductId, line.quantity, null);
    const discountAmount = this._computeDiscountAmount(
      Number(line.unitPriceSnapshot),
      line.quantity,
      discount.discountPercent
    );

    await this.repo.saveLine(line, {
      discountCode: null,
      discountPercent: discount.discountPercent,
      discountAmount,
    });
    return { message: "Discount code removed", cartItem: line };
  }

  _lineTotal(line) {
    const subtotal = round2(Number(line.unitPriceSnapshot) * line.quantity);
    const discountAmount = round2(Number(line.discountAmount));
    return { subtotal, discountAmount, total: round2(subtotal - discountAmount) };
  }

  async getMyCart(userId) {
    const lines = await this.repo.listUserLines(userId);

    const items = lines.map((line) => ({
      ...line.toJSON(),
      ...this._lineTotal(line),
    }));

    const cartTotal = round2(items.reduce((sum, item) => sum + item.total, 0));
    return { items, itemCount: items.length, cartTotal };
  }

  async removeItem(userId, cartItemId) {
    await this.repo.deleteLine(userId, cartItemId);
    return { message: "Item removed" };
  }

  async removeItems(userId, cartItemIds) {
    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      throw new CustomError("cartItemIds must be a non-empty array", 422);
    }
    await this.repo.deleteLines(userId, cartItemIds.map(Number));
    return { message: "Items removed" };
  }

  async clearCart(userId) {
    await this.repo.clearCart(userId);
    return { message: "Cart cleared" };
  }
}

module.exports = ProductCartService;
