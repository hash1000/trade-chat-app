const CartService = require("../services/CartService");

const cartService = new CartService();

function handleError(res, error) {
  const status = error.statusCode || 500;
  if (status < 500) {
    return res.status(status).json({ success: false, error: error.message, code: error.code || undefined });
  }
  console.error("[CartController]", error);
  return res.status(500).json({ success: false, error: "Server error." });
}

class CartController {
  /**
   * POST /cart/services
   * Body: { serviceId, quantity?, cartId? }
   *
   * Logic:
   *   - cartId omitted + no active carts → auto-create cart and add
   *   - cartId omitted + active carts exist → 200 SELECT_CART (return cart list)
   *   - cartId = "new" → always create a fresh cart and add
   *   - cartId = <number> → add to that specific cart (reject duplicate service)
   */
  async addService(req, res) {
    try {
      const userId = req.user.id;
      const { serviceId, quantity = 1, cartId, price } = req.body;

      if (!serviceId) {
        return res.status(400).json({ success: false, error: "serviceId is required.", code: "VALIDATION_ERROR" });
      }

      const result = await cartService.addService(userId, Number(serviceId), Number(quantity), cartId, price);

      // When the service needs the user to pick a cart, return 200 with action flag
      if (result.action === "SELECT_CART") {
        return res.status(200).json({ success: true, ...result });
      }

      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async listCarts(req, res) {
    try {
      const userId = req.user.id;
      const data = await cartService.listCarts(userId);
      return res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async getCart(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const data = await cartService.getCart(userId, cartId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async updateItemQuantity(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);
      const { quantity } = req.body;

      if (quantity === undefined) {
        return res.status(400).json({ success: false, error: "quantity is required.", code: "VALIDATION_ERROR" });
      }

      const data = await cartService.updateItemQuantity(userId, cartId, cartItemId, Number(quantity));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  /**
   * PATCH /cart/:cartId/items/quantity
   * Body: { items: [{ cartItemId, quantity }, ...] }
   * Batch-update quantities for multiple items in one cart (all-or-nothing).
   */
  async updateItemsQuantity(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const { items } = req.body;

      const data = await cartService.updateItemsQuantity(userId, cartId, items);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async removeItem(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);

      const result = await cartService.removeItem(userId, cartId, cartItemId);
      return res.status(200).json({ success: true, message: "Item removed.", ...result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  /**
   * DELETE /cart/:cartId/items
   * Body: { cartItemIds: [id, id, ...] }
   * Batch-remove multiple items from one cart (all-or-nothing).
   */
  async removeItems(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const { cartItemIds } = req.body;

      const result = await cartService.removeItems(userId, cartId, cartItemIds);
      return res.status(200).json({ success: true, message: "Items removed.", ...result });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // Add add-ons to a cart item. Accepts either a batch —
  //   { addOns: [{ addOnId, quantity }] }  or  { addOnIds: [1, 2] }
  // — or the legacy single form { addOnId, quantity }. All normalized to an array.
  async addAddOn(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);
      const { addOns, addOnIds, addOnId, quantity = 1 } = req.body;

      let requested;
      if (Array.isArray(addOns)) {
        requested = addOns;
      } else if (Array.isArray(addOnIds)) {
        requested = addOnIds.map((id) => ({ addOnId: id, quantity: 1 }));
      } else if (addOnId != null) {
        requested = [{ addOnId, quantity }];
      } else {
        return res.status(400).json({ success: false, error: "Provide addOns[], addOnIds[], or addOnId.", code: "VALIDATION_ERROR" });
      }

      const data = await cartService.addAddOns(userId, cartId, cartItemId, requested);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // Remove add-ons from a cart item. Batch via body { addOnIds: [1, 2] }, or a single
  // add-on via the :addOnId path param.
  async removeAddOn(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);

      let addOnIds;
      if (Array.isArray(req.body?.addOnIds)) {
        addOnIds = req.body.addOnIds;
      } else if (req.params.addOnId != null) {
        addOnIds = [Number(req.params.addOnId)];
      } else {
        return res.status(400).json({ success: false, error: "Provide addOnIds[] in the body or :addOnId in the path.", code: "VALIDATION_ERROR" });
      }

      const data = await cartService.removeAddOns(userId, cartId, cartItemId, addOnIds);
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async applyDiscount(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ success: false, error: "code is required.", code: "VALIDATION_ERROR" });
      }

      const data = await cartService.applyDiscount(userId, cartId, cartItemId, code);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async removeDiscount(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);

      const data = await cartService.removeDiscount(userId, cartId, cartItemId);
      return res.status(200).json({ success: true, ...data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async deleteCart(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);

      await cartService.deleteCart(userId, cartId);
      return res.status(200).json({ success: true, message: "Cart deleted." });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = CartController;
