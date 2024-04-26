const Cart = require('../models/cart')

class OrderRepository {
  async getCartByUserId (userId) {
    return await Cart.findAll({ where: { userId } })
  };

  async addItemToCart (userId, productId, quantity) {
    return await Cart.create({ userId, productId, quantity })
  };

  async removeItemFromCart (userId, productId) {
    return await Cart.destroy({ where: { userId, productId } })
  };
}

module.exports = OrderRepository
