const CartService = require('../services/CartService')
const cartService = new CartService()

class CartController {
  async getCart (req, res) {
    try {
      const { id: userId } = req.user
      const cart = await cartService.getCartByUserId(userId)
      res.json(cart)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  };

  // Add an item to the cart
  async addItemToCart (req, res) {
    try {
      const { id: userId } = req.user
      const { productId, quantity } = req.body

      await cartService.addItemToCart(userId, productId, quantity)

      res.status(201).json({ message: 'Item added to the cart' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  };

  // Remove an item from the cart
  async removeItemFromCart (req, res) {
    try {
      const { id: userId } = req.user
      const { productId } = req.params

      await cartService.removeItemFromCart(userId, productId)

      res.json({ message: 'Item removed from the cart' })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  }
}

module.exports = CartController
