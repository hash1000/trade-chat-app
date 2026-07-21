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

  // Validates the requested add-on ids against whichever scope the cart line
  // actually is (the variation's own add-ons, or the product's own add-ons),
  // requires each to be active and in stock, and returns the frozen snapshot
  // shape stored on the cart line: [{ addOnId, name, price }].
  async _resolveAddOns(addOnIds, shopProductId, variationId) {
    if (addOnIds === undefined || addOnIds === null) return [];
    if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
      if (Array.isArray(addOnIds)) return [];
      throw new CustomError("addOnIds must be an array", 422);
    }

    const ids = [...new Set(addOnIds.map(Number))];
    const found = await this.repo.fetchAddOns(ids, shopProductId, variationId);

    if (found.length !== ids.length) {
      throw new CustomError("One or more add-ons were not found for this product", 404);
    }

    for (const addOn of found) {
      if (!addOn.isActive) {
        throw new CustomError(`Add-on "${addOn.name}" is not currently available`, 400);
      }
      if (addOn.stock <= 0) {
        throw new CustomError(`Add-on "${addOn.name}" is out of stock`, 400);
      }
    }

    return found.map((addOn) => ({ addOnId: addOn.id, name: addOn.name, price: Number(addOn.price) }));
  }

  _addOnSubtotal(addOns) {
    return round2((addOns || []).reduce((sum, a) => sum + Number(a.price), 0));
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async addToCart(userId, { shopProductId, variationId, productCartItemQuantity, code, addOnIds }) {
    const qty = productCartItemQuantity === undefined ? 1 : Number(productCartItemQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new CustomError("productCartItemQuantity must be an integer >= 1", 422);
    }

    const { unitPrice, availableStock } = await this._resolveSource(
      Number(shopProductId),
      variationId
    );

    const resolvedAddOns = await this._resolveAddOns(addOnIds, Number(shopProductId), variationId ? Number(variationId) : null);

    const existing = await this.repo.findExistingLine(userId, Number(shopProductId), variationId ?? null);
    const newQuantity = existing ? existing.productCartItemQuantity + qty : qty;
    this._assertStock(availableStock, newQuantity);

    const discount = await this._resolveDiscount(Number(shopProductId), newQuantity, code);
    const discountAmount = this._computeDiscountAmount(unitPrice, newQuantity, discount.discountPercent);

    if (existing) {
      // Re-adding replaces the add-on selection rather than merging it — merging
      // quantity silently duplicating add-on picks would be surprising.
      await this.repo.saveLine(existing, {
        productCartItemQuantity: newQuantity,
        unitPriceSnapshot: unitPrice,
        discountCode: discount.discountCode,
        discountPercent: discount.discountPercent,
        discountAmount,
        ...(addOnIds !== undefined ? { addOns: resolvedAddOns } : {}),
      });
      return { message: "Quantity increased", cartItem: existing };
    }

    const created = await this.repo.createLine({
      userId,
      shopProductId: Number(shopProductId),
      variationId: variationId ? Number(variationId) : null,
      productCartItemQuantity: qty,
      unitPriceSnapshot: unitPrice,
      discountCode: discount.discountCode,
      discountPercent: discount.discountPercent,
      discountAmount,
      addOns: resolvedAddOns,
    });
    return { message: "Product added to cart", cartItem: created };
  }

  async addAddOns(userId, cartItemId, addOnIds) {
    if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
      throw new CustomError("addOnIds must be a non-empty array", 422);
    }

    const line = await this.repo.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);

    const resolved = await this._resolveAddOns(addOnIds, line.shopProductId, line.variationId);

    // Upsert by addOnId: replace an already-selected add-on's snapshot, append new ones.
    const byId = new Map((line.addOns || []).map((a) => [a.addOnId, a]));
    for (const addOn of resolved) byId.set(addOn.addOnId, addOn);
    const merged = [...byId.values()];

    await this.repo.saveLine(line, { addOns: merged });
    return { message: "Add-ons updated", cartItem: line };
  }

  async removeAddOns(userId, cartItemId, addOnIds) {
    if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
      throw new CustomError("addOnIds must be a non-empty array", 422);
    }

    const line = await this.repo.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);

    const toRemove = new Set(addOnIds.map(Number));
    const remaining = (line.addOns || []).filter((a) => !toRemove.has(a.addOnId));

    await this.repo.saveLine(line, { addOns: remaining });
    return { message: "Add-ons removed", cartItem: line };
  }

  async updateQuantity(userId, cartItemId, productCartItemQuantity) {
    const qty = Number(productCartItemQuantity);
    if (!Number.isInteger(qty) || qty < 0) {
      throw new CustomError("productCartItemQuantity must be an integer >= 0", 422);
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
      productCartItemQuantity: qty,
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

    const discount = await this._resolveDiscount(line.shopProductId, line.productCartItemQuantity, code);
    const discountAmount = this._computeDiscountAmount(
      Number(line.unitPriceSnapshot),
      line.productCartItemQuantity,
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
    const discount = await this._resolveDiscount(line.shopProductId, line.productCartItemQuantity, null);
    const discountAmount = this._computeDiscountAmount(
      Number(line.unitPriceSnapshot),
      line.productCartItemQuantity,
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
    const subtotal = round2(Number(line.unitPriceSnapshot) * line.productCartItemQuantity);
    const discountAmount = round2(Number(line.discountAmount));
    const addOnSubtotal = this._addOnSubtotal(line.addOns);
    // Discount applies to the product/variation price only — add-ons are never discounted.
    const total = round2(subtotal - discountAmount + addOnSubtotal);
    return { subtotal, discountAmount, addOnSubtotal, total };
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
