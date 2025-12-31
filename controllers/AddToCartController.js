const AddToCartService = require("../services/AddToCartService");
const addToCartService = new AddToCartService();

class AddToCartController {

  async addToCart(req, res) {
    try {
      const { id: userId } = req.user;
      const { shopProductId } = req.body;

      const result = await addToCartService.addToCart(userId, shopProductId);
      return res.status(201).json(result);
    } catch (e) {
      return res.status(e.statusCode || 500).json({ message: e.message });
    }
  }

  async updateQuantity(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartId, quantity } = req.body;

      const result = await addToCartService.updateQuantity(userId, cartId, quantity);
      return res.json(result);
    } catch (e) {
      return res.status(e.statusCode || 500).json({ message: e.message });
    }
  }

  async getMyCart(req, res) {
    try {
      const { id: userId } = req.user;
      const cart = await addToCartService.getMyCart(userId);
      return res.json(cart);
    } catch (e) {
      return res.status(500).json({ message: "Failed to load cart" });
    }
  }

  async removeItem(req, res) {
    try {
      const { id: userId } = req.user;
      const { cartId } = req.params;

      const result = await addToCartService.removeFromCart(userId, cartId);
      return res.json(result);
    } catch (e) {
      return res.status(e.statusCode || 500).json({ message: e.message });
    }
  }

  async removeCart(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await addToCartService.removeCart(userId);
      return res.json(result);
    } catch (e) {
      return res.status(e.statusCode || 500).json({ message: e.message });
    }
  }
}

module.exports = AddToCartController;
