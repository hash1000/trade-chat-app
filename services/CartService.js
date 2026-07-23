const sequelize = require("../config/database");
const CartRepository = require("../repositories/CartRepository");

const repo = new CartRepository();

function clientError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

function assertValidQuantity(qty) {
  if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
    throw clientError("Quantity must be an integer between 1 and 100.", 400, "VALIDATION_ERROR");
  }
}

/**
 * Resolve the snapshot price for a service when adding it to the cart.
 *   - free  → 0
 *   - fixed → service.price
 *   - range → buyer-supplied price (optional). If supplied, it must fall within
 *             [min_price, max_price]; if omitted, defaults to min_price.
 */
function resolveServicePrice(service, providedPrice) {
  if (service.pricing_type === "free") return 0;

  if (service.pricing_type === "range") {
    const min = service.min_price != null ? parseFloat(service.min_price) : null;
    const max = service.max_price != null ? parseFloat(service.max_price) : null;

    if (providedPrice === undefined || providedPrice === null || providedPrice === "") {
      return min != null ? min : 0;
    }

    const p = parseFloat(providedPrice);
    if (!Number.isFinite(p) || p < 0) {
      throw clientError("price must be a non-negative number.", 400, "VALIDATION_ERROR");
    }
    if (min != null && p < min) {
      throw clientError(`price must be at least ${min} for this service.`, 400, "VALIDATION_ERROR");
    }
    if (max != null && p > max) {
      throw clientError(`price must not exceed ${max} for this service.`, 400, "VALIDATION_ERROR");
    }
    return p;
  }

  // fixed (default)
  return parseFloat(service.price || 0);
}

function computeItemTotals(item) {
  const price = parseFloat(item.servicePriceSnapshot);
  const qty = item.quantity;
  const subtotal = price * qty;
  const discountAmount = parseFloat(item.discountAmount) || 0;
  // Discount applies to service price ONLY — add-ons are never discounted
  const finalAmount = subtotal - discountAmount;
  const addOns = Array.isArray(item.addOns) ? item.addOns : [];
  const addOnSubtotal = addOns.reduce((sum, a) => sum + parseFloat(a.price) * a.quantity, 0);
  return { subtotal, discountAmount, finalAmount, addOnSubtotal, itemTotal: finalAmount + addOnSubtotal };
}

// Required add-ons always mirror the parent service's quantity — the customer
// cannot set their quantity independently. Optional add-ons are left untouched.
function syncRequiredAddOnQuantity(addOns, quantity) {
  if (!Array.isArray(addOns) || addOns.length === 0) return addOns;
  return addOns.map((a) => (a.isRequired ? { ...a, quantity } : a));
}

async function computeCartTotal(cartId) {
  const items = await repo.getCartItems(cartId);
  return items.reduce((sum, item) => sum + computeItemTotals(item).itemTotal, 0);
}

async function nextCartLabel(userId) {
  const existing = await repo.listUserCarts(userId);
  return `Cart ${existing.length + 1}`;
}

class CartService {
  /**
   * Smart "add service" entry point:
   *  - No active carts → auto-create a new cart and add the service
   *  - Active carts exist + no cartId supplied → return list of active carts for the caller to choose
   *  - cartId supplied → add to that cart (reject duplicate service)
   *  - cartId = "new" → always create a fresh cart and add
   */
  async addService(userId, serviceId, quantity, cartId, price) {
    assertValidQuantity(quantity);

    const service = await repo.fetchService(serviceId);
    if (!service) throw clientError("Service not found.", 404, "NOT_FOUND");
    // if (service.userId === userId) throw clientError("Cannot purchase your own service.", 403, "OWNERSHIP_ERROR");

    const activeCarts = await repo.listActiveCarts(userId);

    // const cartq = await repo.getCartByUserId(userId);
    // console.log("cart>>>>",cartq);
    // Case 1: force-create a new cart regardless
    if (cartId === "new") {
      const label = await nextCartLabel(userId);
      const cart = await repo.createCart(userId, label);
      return this._addToCart(cart, serviceId, service, quantity, price);
    }

    // Case 2: no active carts — auto-create
    if (activeCarts.length === 0) {
      const cart = await repo.createCart(userId, "Cart 1");
      return this._addToCart(cart, serviceId, service, quantity, price);
    }

    // Case 3: carts exist but caller didn't choose one — return options
    if (!cartId) {
      return {
        action: "SELECT_CART",
        message: "You have existing carts. Choose one to add this service, or pass cartId: 'new' to create a new cart.",
        carts: activeCarts.map((c) => ({ id: c.id, name: c.name, itemCount: c.itemCount })),
      };
    }

    // Case 4: specific cartId provided — validate ownership then add
    const cart = await repo.findUserCart(userId, Number(cartId));
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");
    if (cart.status !== "active") throw clientError("Cart is no longer active.", 400, "CART_CONVERTED");

    return this._addToCart(cart, serviceId, service, quantity, price);
  }

  async _addToCart(cart, serviceId, service, quantity, providedPrice) {
    const existing = await repo.findCartItem(cart.id, serviceId);
    if (existing) {
      throw clientError(
        "This service is already in the cart. Remove it first or choose a different cart.",
        409,
        "SERVICE_ALREADY_IN_CART"
      );
    }

    const price = resolveServicePrice(service, providedPrice);

    // Persist the negotiated/provided price back to the service record
    if (providedPrice !== undefined && providedPrice !== null && providedPrice !== "") {
      await service.update({ price });
    }

    const cartItem = await repo.createCartItem(cart.id, serviceId, quantity, price);

    // Auto-attach any required add-ons for this service — the customer cannot opt out.
    const serviceAddOns = await repo.fetchAddOnsByService(serviceId);
    const requiredAddOns = serviceAddOns.filter((a) => a.isRequired);
    if (requiredAddOns.length > 0) {
      const addOns = requiredAddOns.map((a) => ({
        addOnId: a.id,
        title: a.title,
        quantity: 1,
        price: parseFloat(a.amount),
        isRequired: true,
      }));
      await repo.updateCartItem(cartItem, { addOns });
    }

    const updatedItem = await repo.findCartItemByIdAndCart(cartItem.id, cart.id);
    const t = computeItemTotals(updatedItem);
    const cartTotal = await computeCartTotal(cart.id);

    return {
      cartId: cart.id,
      cartName: cart.name,
      cartItemId: cartItem.id,
      serviceId,
      serviceName: service.name,
      quantity: updatedItem.quantity,
      price,
      subtotal: t.subtotal,
      addOns: updatedItem.addOns,
      addOnSubtotal: t.addOnSubtotal,
      itemTotal: t.itemTotal,
      cartTotal,
    };
  }

  async listCarts(userId) {
    const carts = await repo.listUserCarts(userId);
    const result = [];
    for (const cart of carts) {
      const items = await repo.getCartItems(cart.id);
      const enriched = items.map((item) => {
        const t = computeItemTotals(item);
        return { ...item.toJSON(), ...t };
      });
      const totalAmount = enriched.reduce((s, i) => s + i.itemTotal, 0);
      result.push({
        id: cart.id,
        name: cart.name,
        status: cart.status,
        itemCount: items.length,
        totalAmount,
        items: enriched,
      });
    }
    return result;
  }

  async getCart(userId, cartId) {
    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const items = await repo.getCartItems(cartId);
    const enrichedItems = [];
    let cartTotal = 0;

    for (const item of items) {
      const svc = await repo.fetchService(item.serviceId);
      const t = computeItemTotals(item);
      cartTotal += t.itemTotal;
      enrichedItems.push({
        cartItemId: item.id,
        serviceId: item.serviceId,
        serviceName: svc ? svc.name : null,
        quantity: item.quantity,
        price: parseFloat(item.servicePriceSnapshot),
        subtotal: t.subtotal,
        discountCode: item.discountCode,
        discountPercent: parseFloat(item.discountPercent),
        discountAmount: t.discountAmount,
        finalAmount: t.finalAmount,
        addOns: (item.addOns || []).map((a) => ({
          addOnId: a.addOnId,
          title: a.title,
          quantity: a.quantity,
          price: a.price,
          isRequired: !!a.isRequired,
          subtotal: parseFloat(a.price) * a.quantity,
        })),
        addOnSubtotal: t.addOnSubtotal,
        itemTotal: t.itemTotal,
      });
    }

    return {
      id: cart.id,
      name: cart.name,
      status: cart.status,
      itemCount: items.length,
      items: enrichedItems,
      cartTotal,
    };
  }

  async updateItemQuantity(userId, cartId, cartItemId, quantity) {
    assertValidQuantity(quantity);

    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    const addOns = syncRequiredAddOnQuantity(item.addOns, quantity);
    await repo.updateCartItem(item, { quantity, addOns });
    const t = computeItemTotals({ ...item.toJSON(), quantity, addOns });
    const cartTotal = await computeCartTotal(cartId);

    return { quantity, subtotal: t.subtotal, addOnSubtotal: t.addOnSubtotal, itemTotal: t.itemTotal, cartTotal };
  }

  /**
   * Batch-update quantities for multiple items in a single cart.
   * All-or-nothing: every item is validated (existence + quantity bounds)
   * before any write happens; one bad item rejects the whole request and
   * nothing is changed.
   *
   * @param {number} userId
   * @param {number} cartId
   * @param {Array<{ cartItemId: number, quantity: number }>} items
   */
  async updateItemsQuantity(userId, cartId, items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw clientError("items must be a non-empty array.", 400, "VALIDATION_ERROR");
    }

    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    // ── Phase 1: validate everything first (no writes) ──────────────────────────
    const seen = new Set();
    const resolved = [];
    for (const entry of items) {
      const cartItemId = Number(entry.cartItemId);
      const quantity = Number(entry.quantity);

      if (!Number.isInteger(cartItemId) || cartItemId < 1) {
        throw clientError("Each item requires a valid cartItemId.", 400, "VALIDATION_ERROR");
      }
      if (seen.has(cartItemId)) {
        throw clientError(`Duplicate cartItemId ${cartItemId} in request.`, 400, "VALIDATION_ERROR");
      }
      seen.add(cartItemId);

      assertValidQuantity(quantity);

      const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
      if (!item) throw clientError(`Cart item ${cartItemId} not found.`, 404, "NOT_FOUND");

      resolved.push({ item, cartItemId, quantity });
    }

    // ── Phase 2: apply all updates atomically ───────────────────────────────────
    await sequelize.transaction(async (t) => {
      for (const { item, quantity } of resolved) {
        const addOns = syncRequiredAddOnQuantity(item.addOns, quantity);
        await repo.updateCartItem(item, { quantity, addOns }, t);
      }
    });

    const updated = resolved.map(({ item, cartItemId, quantity }) => {
      const addOns = syncRequiredAddOnQuantity(item.addOns, quantity);
      const itemTotals = computeItemTotals({ ...item.toJSON(), quantity, addOns });
      return {
        cartItemId,
        quantity,
        subtotal: itemTotals.subtotal,
        addOnSubtotal: itemTotals.addOnSubtotal,
        itemTotal: itemTotals.itemTotal,
      };
    });
    const cartTotal = await computeCartTotal(cartId);

    return { items: updated, cartTotal };
  }

  async removeItem(userId, cartId, cartItemId) {
    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    await repo.deleteCartItem(cartItemId);
    const items = await repo.getCartItems(cartId);
    const cartTotal = items.reduce((sum, i) => sum + computeItemTotals(i).itemTotal, 0);

    return { cartTotal, itemCount: items.length };
  }

  /**
   * Batch-remove multiple items from a single cart.
   * All-or-nothing: every id is validated to exist in the cart before any
   * delete happens; one unknown id rejects the whole request.
   *
   * @param {number} userId
   * @param {number} cartId
   * @param {Array<number>} cartItemIds
   */
  async removeItems(userId, cartId, cartItemIds) {
    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      throw clientError("cartItemIds must be a non-empty array.", 400, "VALIDATION_ERROR");
    }

    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    // ── Phase 1: validate every id (no deletes) ─────────────────────────────────
    const seen = new Set();
    const ids = [];
    for (const raw of cartItemIds) {
      const cartItemId = Number(raw);
      if (!Number.isInteger(cartItemId) || cartItemId < 1) {
        throw clientError("Each cartItemId must be a valid integer.", 400, "VALIDATION_ERROR");
      }
      if (seen.has(cartItemId)) continue; // de-dupe silently
      seen.add(cartItemId);

      const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
      if (!item) throw clientError(`Cart item ${cartItemId} not found.`, 404, "NOT_FOUND");

      ids.push(cartItemId);
    }

    // ── Phase 2: delete all atomically ──────────────────────────────────────────
    const deletedCount = await sequelize.transaction(async (t) => repo.deleteCartItems(ids, t));

    const items = await repo.getCartItems(cartId);
    const cartTotal = items.reduce((sum, i) => sum + computeItemTotals(i).itemTotal, 0);

    return { deletedCount, removedItemIds: ids, cartTotal, itemCount: items.length };
  }

  // Add one or more add-ons to a cart item. `requested` is an array of
  // { addOnId, quantity } — a single add-on is just a one-element array. Each add-on
  // is validated (exists + belongs to this service) before anything is written; the
  // whole batch is applied in one update. Re-adding an existing addOnId updates it.
  async addAddOns(userId, cartId, cartItemId, requested) {
    if (!Array.isArray(requested) || requested.length === 0) {
      throw clientError("addOns must be a non-empty array.", 400, "VALIDATION_ERROR");
    }

    const normalized = requested.map((r) => {
      const addOnId = Number(r.addOnId);
      const quantity = Number(r.quantity ?? 1);
      if (!addOnId || Number.isNaN(addOnId)) {
        throw clientError("Each add-on must have a valid addOnId.", 400, "VALIDATION_ERROR");
      }
      assertValidQuantity(quantity);
      return { addOnId, quantity };
    });

    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    // Validate every requested add-on against the catalog + this service first, so a
    // bad id rejects the whole batch before any write.
    const resolved = [];
    for (const { addOnId, quantity } of normalized) {
      const addOn = await repo.fetchAddOn(addOnId);
      if (!addOn) throw clientError(`Add-on ${addOnId} not found.`, 404, "NOT_FOUND");
      if (addOn.serviceId !== item.serviceId) {
        throw clientError(`Add-on ${addOnId} does not belong to this service.`, 400, "VALIDATION_ERROR");
      }
      resolved.push({ addOnId, quantity, title: addOn.title, price: parseFloat(addOn.amount), isRequired: !!addOn.isRequired });
    }

    const addOns = Array.isArray(item.addOns) ? [...item.addOns] : [];
    const applied = [];
    for (const r of resolved) {
      // A required add-on's quantity always mirrors the service quantity — ignore any
      // caller-supplied quantity for it rather than letting it drift out of sync.
      const quantity = r.isRequired ? item.quantity : r.quantity;
      const entry = { addOnId: r.addOnId, title: r.title, quantity, price: r.price, isRequired: r.isRequired };
      const existingIdx = addOns.findIndex((a) => a.addOnId === r.addOnId);
      if (existingIdx >= 0) addOns[existingIdx] = entry;
      else addOns.push(entry);
      applied.push(entry);
    }

    await repo.updateCartItem(item, { addOns });

    const updatedItem = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    const t = computeItemTotals(updatedItem);

    return {
      addOns: applied,
      addOnSubtotal: t.addOnSubtotal,
      itemTotal: t.itemTotal,
    };
  }

  // Remove one or more add-ons from a cart item. `addOnIds` is an array of ids.
  async removeAddOns(userId, cartId, cartItemId, addOnIds) {
    if (!Array.isArray(addOnIds) || addOnIds.length === 0) {
      throw clientError("addOnIds must be a non-empty array.", 400, "VALIDATION_ERROR");
    }
    const idSet = new Set(addOnIds.map((id) => Number(id)));

    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    const before = Array.isArray(item.addOns) ? item.addOns : [];

    const blocked = before.filter((a) => idSet.has(a.addOnId) && a.isRequired);
    if (blocked.length > 0) {
      throw clientError(
        `This add-on is required and cannot be removed: ${blocked.map((a) => a.title).join(", ")}.`,
        400,
        "ADDON_REQUIRED"
      );
    }

    const addOns = before.filter((a) => !idSet.has(a.addOnId));
    const removedCount = before.length - addOns.length;

    await repo.updateCartItem(item, { addOns });

    const updatedItem = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    const t = computeItemTotals(updatedItem);
    return { removedCount, addOnSubtotal: t.addOnSubtotal, itemTotal: t.itemTotal };
  }

  async applyDiscount(userId, cartId, cartItemId, code) {
    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    if (item.discountCode) {
      throw clientError("Discount already applied to this item.", 409, "DUPLICATE_DISCOUNT");
    }

    const discount = await repo.fetchDiscount(code, item.serviceId);
    if (!discount) throw clientError("Discount not found or not valid for this service.", 400, "INVALID_DISCOUNT");
    if (!discount.isActive) throw clientError("Discount code is inactive.", 400, "INVALID_DISCOUNT");
    if (discount.isUsed) throw clientError("Discount code has already been used.", 400, "INVALID_DISCOUNT");
    if (discount.expiryDate && new Date(discount.expiryDate) < new Date()) {
      throw clientError("Discount code has expired.", 400, "INVALID_DISCOUNT");
    }

    // Discount is calculated on service price × quantity ONLY — add-ons excluded
    const serviceSubtotal = parseFloat(item.servicePriceSnapshot) * item.quantity;
    const discountPercent = parseFloat(discount.discountPercentage);
    const discountAmount = parseFloat(((serviceSubtotal * discountPercent) / 100).toFixed(8));

    await repo.updateCartItem(item, { discountCode: discount.code, discountPercent, discountAmount });

    const updatedItem = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    const t = computeItemTotals(updatedItem);

    return {
      discountCode: discount.code,
      discountPercent,
      serviceSubtotal,
      discountAmount,
      finalServiceAmount: t.finalAmount,
      addOnSubtotal: t.addOnSubtotal,
      itemTotal: t.itemTotal,
    };
  }

  async removeDiscount(userId, cartId, cartItemId) {
    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    await repo.updateCartItem(item, { discountCode: null, discountPercent: 0, discountAmount: 0 });

    const updatedItem = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    const t = computeItemTotals(updatedItem);
    return { addOnSubtotal: t.addOnSubtotal, itemTotal: t.itemTotal };
  }

  async deleteCart(userId, cartId) {
    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");
    await repo.deleteCart(cartId);
  }
}

module.exports = CartService;
