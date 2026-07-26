const ProductCartService = require("../services/ProductCartService");
const cartService = new ProductCartService();

function handle(res, error, fallback) {
  console.error(fallback, error);
  return res
    .status(error.statusCode || 500)
    .json({ success: false, error: error.message || "Server error. Please try again later." });
}

class ProductCartController {
  async addToCart(req, res) {
    try {
      const { id: userId } = req.user;
      const { shopProductId, variationId, productCartItemQuantity, code, addOns } = req.body;

      const result = await cartService.addToCart(userId, {
        shopProductId,
        variationId,
        productCartItemQuantity,
        code,
        addOns,
      });
      return res.status(201).json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.addToCart error:");
    }
  }

  async getMyCart(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await cartService.getMyCart(userId);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.getMyCart error:");
    }
  }

  async updateQuantity(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemId } = req.params;
      const { productCartItemQuantity, addOns } = req.body;

      const result = await cartService.updateQuantity(userId, Number(cartItemId), productCartItemQuantity, addOns);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.updateQuantity error:");
    }
  }

  async applyDiscountCode(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemId } = req.params;
      const { code } = req.body;

      const result = await cartService.applyDiscountCode(userId, Number(cartItemId), code);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.applyDiscountCode error:");
    }
  }

  async removeDiscountCode(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemId } = req.params;

      const result = await cartService.removeDiscountCode(userId, Number(cartItemId));
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.removeDiscountCode error:");
    }
  }

  async addAddOns(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemId } = req.params;
      const { addOns } = req.body;

      const result = await cartService.addAddOns(userId, Number(cartItemId), addOns);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.addAddOns error:");
    }
  }

  async removeAddOns(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemId } = req.params;
      const { addOnIds } = req.body;

      const result = await cartService.removeAddOns(userId, Number(cartItemId), addOnIds);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.removeAddOns error:");
    }
  }

  async removeItem(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemId } = req.params;

      const result = await cartService.removeItem(userId, Number(cartItemId));
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.removeItem error:");
    }
  }

  async removeItems(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartItemIds } = req.body;

      const result = await cartService.removeItems(userId, cartItemIds);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.removeItems error:");
    }
  }

  async clearCart(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await cartService.clearCart(userId);
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductCartController.clearCart error:");
    }
  }
}

module.exports = ProductCartController;
