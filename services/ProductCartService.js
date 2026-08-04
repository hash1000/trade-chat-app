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

  // Snapshot shape stored on a cart line for one add-on: [{ addOnId, name,
  // price, quantity, image, isRequired }]. Carries only the first/primary
  // image, not the whole gallery — a cart line thumbnail doesn't need every
  // picture.
  _toSnapshot(addOn, quantity = 1) {
    return {
      addOnId: addOn.id,
      name: addOn.name,
      price: Number(addOn.price),
      quantity,
      image: addOn.images && addOn.images.length > 0 ? addOn.images[0].url : null,
      isRequired: !!addOn.isRequired,
    };
  }

  // Validates the requested add-ons against whichever scope the cart line
  // actually is (the variation's own add-ons, or the product's own add-ons),
  // requires each to be active and to have enough stock for the requested
  // quantity, and returns the frozen snapshot. `requested` is an array of
  // { addOnId, quantity } — quantity defaults to 1 when omitted.
  async _resolveAddOns(requested, shopProductId, variationId) {
    if (requested === undefined || requested === null) return [];
    if (!Array.isArray(requested)) {
      throw new CustomError("addOns must be an array", 422);
    }
    if (requested.length === 0) return [];

    // De-dupe by addOnId — a later entry for the same id overrides an earlier one.
    const quantityById = new Map();
    for (const r of requested) {
      const addOnId = Number(r.addOnId);
      const quantity = Number(r.quantity ?? 1);
      if (!Number.isInteger(addOnId) || addOnId < 1) {
        throw new CustomError("Each add-on must have a valid addOnId", 422);
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new CustomError("Each add-on quantity must be an integer >= 1", 422);
      }
      quantityById.set(addOnId, quantity);
    }

    const ids = [...quantityById.keys()];
    const found = await this.repo.fetchAddOns(ids, shopProductId, variationId);

    if (found.length !== ids.length) {
      throw new CustomError("One or more add-ons were not found for this product", 404);
    }

    return found.map((addOn) => {
      const quantity = quantityById.get(addOn.id);
      if (!addOn.isActive) {
        throw new CustomError(`Add-on "${addOn.name}" is not currently available`, 400);
      }
      if (addOn.stock <= 0) {
        throw new CustomError(`Add-on "${addOn.name}" is out of stock`, 400);
      }
      if (quantity > addOn.stock) {
        throw new CustomError(`Only ${addOn.stock} unit(s) of add-on "${addOn.name}" available`, 400);
      }
      return this._toSnapshot(addOn, quantity);
    });
  }

  // Add-ons the customer cannot opt out of — fetched fresh from whichever
  // scope the cart line is (variation's own add-ons, or the product's own)
  // so they get auto-attached on add-to-cart regardless of what the caller
  // requested. Always quantity 1 unless the caller also selected the same
  // add-on explicitly (handled by the merge step keeping the caller's pick).
  async _resolveRequiredAddOns(shopProductId, variationId) {
    const required = await this.repo.fetchRequiredAddOns(shopProductId, variationId);
    return required.map((addOn) => this._toSnapshot(addOn, 1));
  }

  // Upserts requiredAddOns into baseAddOns by addOnId — an id already present
  // in baseAddOns keeps its existing snapshot (already resolved/validated);
  // only missing required ones get appended.
  _mergeAddOns(baseAddOns, requiredAddOns) {
    const byId = new Map((baseAddOns || []).map((a) => [a.addOnId, a]));
    for (const req of requiredAddOns) {
      if (!byId.has(req.addOnId)) byId.set(req.addOnId, req);
    }
    return [...byId.values()];
  }

  // Required add-ons track the line's product quantity 1:1 — the customer
  // can't opt out or set them independently, so bumping product quantity
  // must scale them too.
  _scaleRequiredAddOns(addOns, quantity) {
    if (!Array.isArray(addOns) || addOns.length === 0) return addOns;
    return addOns.map((a) => (a.isRequired && a.quantity !== quantity ? { ...a, quantity } : a));
  }

  _addOnSubtotal(addOns) {
    return round2((addOns || []).reduce((sum, a) => sum + Number(a.price) * Number(a.quantity ?? 1), 0));
  }

  // ── Public API ───────────────────────────────────────────────────────────

  async addToCart(userId, { shopProductId, variationId, productCartItemQuantity, code, addOns }) {
    const qty = productCartItemQuantity === undefined ? 1 : Number(productCartItemQuantity);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new CustomError("productCartItemQuantity must be an integer >= 1", 422);
    }

    const { unitPrice, availableStock } = await this._resolveSource(
      Number(shopProductId),
      variationId
    );

    const scopedVariationId = variationId ? Number(variationId) : null;
    const resolvedAddOns = await this._resolveAddOns(addOns, Number(shopProductId), scopedVariationId);
    const requiredAddOns = await this._resolveRequiredAddOns(Number(shopProductId), scopedVariationId);

    const existing = await this.repo.findExistingLine(userId, Number(shopProductId), variationId ?? null);
    const newQuantity = existing ? existing.productCartItemQuantity + qty : qty;
    this._assertStock(availableStock, newQuantity);

    const discount = await this._resolveDiscount(Number(shopProductId), newQuantity, code);
    const discountAmount = this._computeDiscountAmount(unitPrice, newQuantity, discount.discountPercent);

    if (existing) {
      // Re-adding replaces the add-on selection rather than merging it — merging
      // quantity silently duplicating add-on picks would be surprising. Required
      // add-ons are always ensured present either way, since the customer can't
      // opt out of them.
      const baseAddOns = addOns !== undefined ? resolvedAddOns : existing.addOns || [];
      await this.repo.saveLine(existing, {
        productCartItemQuantity: newQuantity,
        unitPriceSnapshot: unitPrice,
        discountCode: discount.discountCode,
        discountPercent: discount.discountPercent,
        discountAmount,
        addOns: this._mergeAddOns(baseAddOns, requiredAddOns),
      });
      return { message: "Quantity increased", cartItem: existing };
    }

    const created = await this.repo.createLine({
      userId,
      shopProductId: Number(shopProductId),
      variationId: scopedVariationId,
      productCartItemQuantity: qty,
      unitPriceSnapshot: unitPrice,
      discountCode: discount.discountCode,
      discountPercent: discount.discountPercent,
      discountAmount,
      addOns: this._mergeAddOns(resolvedAddOns, requiredAddOns),
    });
    return { message: "Product added to cart", cartItem: created };
  }

  // `addOns` is an array of { addOnId, quantity } — quantity defaults to 1.
  async addAddOns(userId, cartItemId, addOns) {
    if (!Array.isArray(addOns) || addOns.length === 0) {
      throw new CustomError("addOns must be a non-empty array", 422);
    }

    const line = await this.repo.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);

    const resolved = await this._resolveAddOns(addOns, line.shopProductId, line.variationId);

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
    const blocked = (line.addOns || []).filter((a) => toRemove.has(a.addOnId) && a.isRequired);
    if (blocked.length > 0) {
      throw new CustomError(
        `This add-on is required and cannot be removed: ${blocked.map((a) => a.name).join(", ")}.`,
        400
      );
    }

    const remaining = (line.addOns || []).filter((a) => !toRemove.has(a.addOnId));

    await this.repo.saveLine(line, { addOns: remaining });
    return { message: "Add-ons removed", cartItem: line };
  }

  // `addOns`, when provided, replaces the line's optional add-on selection in
  // the same call — an array of { addOnId, quantity }. Omit it to leave the
  // existing add-on selection untouched. Required add-ons are always
  // re-ensured present either way.
  async updateQuantity(userId, cartItemId, productCartItemQuantity, addOns) {
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

    const fields = {
      productCartItemQuantity: qty,
      unitPriceSnapshot: unitPrice,
      discountCode: discount.discountCode,
      discountPercent: discount.discountPercent,
      discountAmount,
    };

    if (addOns !== undefined) {
      const resolvedAddOns = await this._resolveAddOns(addOns, line.shopProductId, line.variationId);
      const requiredAddOns = await this._resolveRequiredAddOns(line.shopProductId, line.variationId);
      fields.addOns = this._mergeAddOns(resolvedAddOns, requiredAddOns);
    }

    fields.addOns = this._scaleRequiredAddOns(fields.addOns ?? line.addOns, qty);

    await this.repo.saveLine(line, fields);
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

    const items = lines.map((line) => {
      const json = line.toJSON();
      return {
        ...json,
        // Coerces isRequired/quantity for cart lines snapshotted before those
        // fields existed, where they're simply absent from the JSON blob.
        addOns: (json.addOns || []).map((a) => ({
          ...a,
          isRequired: !!a.isRequired,
          quantity: a.quantity ?? 1,
        })),
        ...this._lineTotal(line),
      };
    });

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
