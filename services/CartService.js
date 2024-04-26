const CartRepository = require('../repositories/CartRepository')

class CartService {
  constructor () {
    this.cartRepository = new CartRepository()
  }

  async getCartByUserId (userId) {
    return await this.cartRepository.getCartByUserId(userId)
  };

  async addItemToCart (userId, productId, quantity) {
    return await this.cartRepository.addItemToCart(userId, productId, quantity)
  };

  async removeItemFromCart (userId, productId) {
    return await this.cartRepository.removeItemFromCart(userId, productId)
  }
};

module.exports = CartService
