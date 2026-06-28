const { Cart, CartItem, Service, ServiceAddOn, ServiceDiscount, User } = require("../models");

class CartRepository {
  async createCart(userId, name) {
    return Cart.create({ userId, name, status: "active" });
  }

  async findCartById(cartId) {
    return Cart.findByPk(cartId);
  }

  async findUserCart(userId, cartId) {
    return Cart.findOne({ where: { id: cartId, userId } });
  }

  async listUserCarts(userId) {
    return Cart.findAll({ where: { userId }, order: [["createdAt", "DESC"]] });
  }

  async listActiveCarts(userId) {
    const carts = await Cart.findAll({ where: { userId, status: "active" }, order: [["createdAt", "DESC"]] });
    // Attach itemCount to each for the SELECT_CART response
    const result = [];
    for (const cart of carts) {
      const count = await CartItem.count({ where: { cartId: cart.id } });
      result.push({ id: cart.id, name: cart.name, status: cart.status, itemCount: count });
    }
    return result;
  }

  async getCartByUserId(userId) {
    console.log("CartRepository.getCartItemsByUserId userId:", userId);
    return Cart.findAll({ where: { userId } });
  }

  async updateCartStatus(cartId, status, transaction) {
    return Cart.update({ status }, { where: { id: cartId }, transaction });
  }

  async deleteCart(cartId) {
    return Cart.destroy({ where: { id: cartId } });
  }

  async getCartItems(cartId) {
    return CartItem.findAll({ where: { cartId } });
  }

  async findCartItem(cartId, serviceId) {
    return CartItem.findOne({ where: { cartId, serviceId } });
  }

  async findCartItemById(cartItemId) {
    return CartItem.findByPk(cartItemId);
  }

  async findCartItemByIdAndCart(cartItemId, cartId) {
    return CartItem.findOne({ where: { id: cartItemId, cartId } });
  }

  async createCartItem(cartId, serviceId, quantity, priceSnapshot) {
    return CartItem.create({
      cartId,
      serviceId,
      quantity,
      servicePriceSnapshot: priceSnapshot,
      discountCode: null,
      discountPercent: 0,
      discountAmount: 0,
      addOns: [],
    });
  }

  async updateCartItem(cartItem, fields, transaction) {
    return cartItem.update(fields, transaction ? { transaction } : undefined);
  }

  async deleteCartItem(cartItemId) {
    return CartItem.destroy({ where: { id: cartItemId } });
  }

  async deleteCartItems(cartItemIds, transaction) {
    return CartItem.destroy({ where: { id: cartItemIds }, ...(transaction ? { transaction } : {}) });
  }

  async fetchService(serviceId) {
    return Service.findOne({
      where: { id: serviceId, deletedAt: null },
      attributes: ["id", "userId", "name", "price", "pricing_type", "payoutWalletId"],
    });
  }

  async fetchAddOn(addOnId) {
    return ServiceAddOn.findOne({
      where: { id: addOnId, deletedAt: null },
      attributes: ["id", "serviceId", "title", "amount"],
    });
  }

  async fetchDiscount(code, serviceId) {
    return ServiceDiscount.findOne({
      where: { code: String(code).trim().toUpperCase(), serviceId },
    });
  }
}

module.exports = CartRepository;
