const { Service, ServiceAddOn, ServiceDiscount } = require("../models");

// In-memory cart store: Map<userId, Map<serviceId, cartItem>>
// cartItem: { serviceId, quantity, price, discountCode, discountPercent, discountAmount, addOns: Map<addOnId, { addOnId, title, quantity, price }> }
const carts = new Map();

class OrderCartRepository {
  _getOrCreateUserCart(userId) {
    if (!carts.has(userId)) {
      carts.set(userId, new Map());
    }
    return carts.get(userId);
  }

  async fetchService(serviceId) {
    const service = await Service.findByPk(serviceId, {
      attributes: ["id", "userId", "name", "price", "pricing_type", "payoutWalletId"],
    });
    return service;
  }

  async fetchAddOn(addOnId) {
    const addOn = await ServiceAddOn.findOne({
      where: { id: addOnId, deletedAt: null },
      attributes: ["id", "serviceId", "title", "amount"],
    });
    return addOn;
  }

  async fetchDiscount(code, serviceId) {
    return await ServiceDiscount.findOne({
      where: { code: String(code).trim().toUpperCase(), serviceId },
    });
  }

  getCart(userId) {
    console.log("OrderCartRepository.getCart userId:", userId);
    const userCart = this._getOrCreateUserCart(userId);
    return Array.from(userCart.values()).map((item) => ({
      ...item,
      addOns: Array.from(item.addOns.values()),
    }));
  }

  getCartItem(userId, serviceId) {
    const userCart = this._getOrCreateUserCart(userId);
    const item = userCart.get(serviceId);
    if (!item) return null;
    return { ...item, addOns: Array.from(item.addOns.values()) };
  }

  setCartItem(userId, serviceId, itemData) {
    const userCart = this._getOrCreateUserCart(userId);
    const existing = userCart.get(serviceId);
    userCart.set(serviceId, {
      ...itemData,
      addOns: existing ? existing.addOns : new Map(),
    });
  }

  updateCartItemQuantity(userId, serviceId, quantity) {
    const userCart = this._getOrCreateUserCart(userId);
    const item = userCart.get(serviceId);
    if (!item) return null;
    item.quantity = quantity;
    return { ...item, addOns: Array.from(item.addOns.values()) };
  }

  setCartItemDiscount(userId, serviceId, discountCode, discountPercent, discountAmount) {
    const userCart = this._getOrCreateUserCart(userId);
    const item = userCart.get(serviceId);
    if (!item) return null;
    item.discountCode = discountCode;
    item.discountPercent = discountPercent;
    item.discountAmount = discountAmount;
    return { ...item, addOns: Array.from(item.addOns.values()) };
  }

  setAddOn(userId, serviceId, addOnId, addOnData) {
    const userCart = this._getOrCreateUserCart(userId);
    const item = userCart.get(serviceId);
    if (!item) return null;
    item.addOns.set(addOnId, addOnData);
    return { ...item, addOns: Array.from(item.addOns.values()) };
  }

  removeCartItem(userId, serviceId) {
    const userCart = this._getOrCreateUserCart(userId);
    userCart.delete(serviceId);
  }

  clearCart(userId) {
    carts.delete(userId);
  }
}

module.exports = OrderCartRepository;
