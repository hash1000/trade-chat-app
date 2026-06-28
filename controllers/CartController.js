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
      const { serviceId, quantity = 1, cartId } = req.body;

      if (!serviceId) {
        return res.status(400).json({ success: false, error: "serviceId is required.", code: "VALIDATION_ERROR" });
      }

      const result = await cartService.addService(userId, Number(serviceId), Number(quantity), cartId);

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

  async addAddOn(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);
      const { addOnId, quantity = 1 } = req.body;

      if (!addOnId) {
        return res.status(400).json({ success: false, error: "addOnId is required.", code: "VALIDATION_ERROR" });
      }

      const data = await cartService.addAddOn(userId, cartId, cartItemId, Number(addOnId), Number(quantity));
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async removeAddOn(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const cartItemId = Number(req.params.cartItemId);
      const addOnId = Number(req.params.addOnId);

      const data = await cartService.removeAddOn(userId, cartId, cartItemId, addOnId);
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
