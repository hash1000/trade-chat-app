const AddToCartRepository = require("../repositories/AddToCartRepository");
const ShopProduct = require("../models/shopProduct");
const CustomError = require("../errors/CustomError");

class AddToCartService {
  constructor() {
    this.addToCartRepository = new AddToCartRepository();
  }

  async addToCart(userId, shopProductId) {
    const product = await ShopProduct.findByPk(shopProductId);
    if (!product) throw new CustomError("Product not found", 404);

    return this.addToCartRepository.addOrIncrease(userId, product);
  }

  async updateQuantity(userId, cartId, quantity) {
    return this.addToCartRepository.updateQuantity(userId, cartId, quantity);
  }

  async getMyCart(userId) {
    return this.addToCartRepository.getUserCart(userId);
  }

  async removeFromCart(userId, cartId) {
    return this.addToCartRepository.removeItem(userId, cartId);
  }
  async removeCart(userId) {
    return this.addToCartRepository.removeCart(userId);
  }
}

module.exports = AddToCartService;
