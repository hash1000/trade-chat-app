const AddToCart = require("../models/AddToCart");
const ShopProduct = require("../models/shopProduct");
const CustomError = require("../errors/CustomError");

class AddToCartRepository {

  async addOrIncrease(userId, product) {
    const cart = await AddToCart.findOne({
      where: { userId, shopProductId: product.id },
    });

    if (cart) {
      cart.quantity += 1;
      cart.price = product.price * cart.quantity;
      await cart.save();

      return { message: "Quantity increased", cart };
    }

    const newCart = await AddToCart.create({
      userId,
      shopProductId: product.id,
      quantity: 1,
      price: product.price,
    });

    return { message: "Product added to cart", cart: newCart };
  }

  async updateQuantity(userId, cartId, quantity) {
    const cart = await AddToCart.findOne({ where: { id: cartId, userId } });
    if (!cart) throw new CustomError("Cart item not found", 404);

    if (quantity <= 0) {
      await cart.destroy();
      return { message: "Item removed from cart" };
    }

    const product = await ShopProduct.findByPk(cart.shopProductId);
    cart.quantity = quantity;
    cart.price = product.price * quantity;
    await cart.save();

    return { message: "Quantity updated", cart };
  }

  async getUserCart(userId) {
    return AddToCart.findAll({
      where: { userId },
      include: [{ model: ShopProduct, as: "product" }],
      // order: [["createdAt", "DESC"]],
    });
  }

  async removeItem(userId, cartId) {
    const cart = await AddToCart.findOne({ where: { id: cartId, userId } });
    if (!cart) throw new CustomError("Cart item not found", 404);

    await cart.destroy();
    return { message: "Item removed" };
  }

  async removeCart(userId) {
    await AddToCart.destroy({ where: { userId } });
    return { message: "Cart cleared" };
  }
}

module.exports = AddToCartRepository;
