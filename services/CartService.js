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
  async addService(userId, serviceId, quantity, cartId) {
    assertValidQuantity(quantity);

    const service = await repo.fetchService(serviceId);
    if (!service) throw clientError("Service not found.", 404, "NOT_FOUND");
    if (service.userId === userId) throw clientError("Cannot purchase your own service.", 403, "OWNERSHIP_ERROR");

    const activeCarts = await repo.listActiveCarts(userId);

    // const cartq = await repo.getCartByUserId(userId);
    // console.log("cart>>>>",cartq);
    // Case 1: force-create a new cart regardless
    if (cartId === "new") {
      const label = await nextCartLabel(userId);
      const cart = await repo.createCart(userId, label);
      return this._addToCart(cart, serviceId, service, quantity);
    }

    // Case 2: no active carts — auto-create
    if (activeCarts.length === 0) {
      const cart = await repo.createCart(userId, "Cart 1");
      return this._addToCart(cart, serviceId, service, quantity);
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

    return this._addToCart(cart, serviceId, service, quantity);
  }

  async _addToCart(cart, serviceId, service, quantity) {
    const existing = await repo.findCartItem(cart.id, serviceId);
    if (existing) {
      throw clientError(
        "This service is already in the cart. Remove it first or choose a different cart.",
        409,
        "SERVICE_ALREADY_IN_CART"
      );
    }

    const price = parseFloat(service.price || 0);
    const cartItem = await repo.createCartItem(cart.id, serviceId, quantity, price);
    const t = computeItemTotals(cartItem);
    const cartTotal = await computeCartTotal(cart.id);

    return {
      cartId: cart.id,
      cartName: cart.name,
      cartItemId: cartItem.id,
      serviceId,
      serviceName: service.name,
      quantity: cartItem.quantity,
      price,
      subtotal: t.subtotal,
      addOnSubtotal: 0,
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

    await repo.updateCartItem(item, { quantity });
    const t = computeItemTotals({ ...item.toJSON(), quantity });
    const cartTotal = await computeCartTotal(cartId);

    return { quantity, subtotal: t.subtotal, cartTotal };
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

  async addAddOn(userId, cartId, cartItemId, addOnId, quantity) {
    assertValidQuantity(quantity);

    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    const addOn = await repo.fetchAddOn(addOnId);
    if (!addOn) throw clientError("Add-on not found.", 404, "NOT_FOUND");
    if (addOn.serviceId !== item.serviceId) {
      throw clientError("Add-on does not belong to this service.", 400, "VALIDATION_ERROR");
    }

    const addOns = Array.isArray(item.addOns) ? [...item.addOns] : [];
    const existingIdx = addOns.findIndex((a) => a.addOnId === addOnId);
    const entry = { addOnId, title: addOn.title, quantity, price: parseFloat(addOn.amount) };

    if (existingIdx >= 0) {
      addOns[existingIdx] = entry;
    } else {
      addOns.push(entry);
    }

    await repo.updateCartItem(item, { addOns });

    const updatedItem = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    const t = computeItemTotals(updatedItem);

    return {
      addOnId,
      title: addOn.title,
      quantity,
      price: parseFloat(addOn.amount),
      addOnSubtotal: t.addOnSubtotal,
      itemTotal: t.itemTotal,
    };
  }

  async removeAddOn(userId, cartId, cartItemId, addOnId) {
    const cart = await repo.findUserCart(userId, cartId);
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");

    const item = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    if (!item) throw clientError("Cart item not found.", 404, "NOT_FOUND");

    const addOns = (Array.isArray(item.addOns) ? item.addOns : []).filter((a) => a.addOnId !== addOnId);
    await repo.updateCartItem(item, { addOns });

    const updatedItem = await repo.findCartItemByIdAndCart(cartItemId, cartId);
    const t = computeItemTotals(updatedItem);
    return { addOnSubtotal: t.addOnSubtotal, itemTotal: t.itemTotal };
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
