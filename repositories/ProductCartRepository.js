const {
  ProductCartItem,
  ShopProduct,
  ProductVariation,
  ProductImage,
  ProductVariationImage,
  ProductAddOn,
  ProductAddOnImage,
} = require("../models");
const sequelize = require("../config/database");
const CustomError = require("../errors/CustomError");

class ProductCartRepository {
  async fetchProduct(shopProductId) {
    return ShopProduct.findByPk(shopProductId);
  }

  async fetchVariation(variationId, shopProductId) {
    return ProductVariation.findOne({ where: { id: variationId, shopProductId } });
  }

  // Add-ons scoped to whichever the cart line actually is: a variation's own
  // add-ons when variationId is set, otherwise the product's own add-ons.
  // Images included so the service can snapshot the first one as the cart
  // line's addOns[].image.
  async fetchAddOns(addOnIds, shopProductId, variationId) {
    return ProductAddOn.findAll({
      where: variationId
        ? { id: addOnIds, variationId }
        : { id: addOnIds, shopProductId },
      include: [{ model: ProductAddOnImage, as: "images", attributes: ["id", "url", "thumbnailUrl"] }],
    });
  }

  // All active, required add-ons in scope — auto-attached on add-to-cart
  // since the customer cannot opt out of them.
  async fetchRequiredAddOns(shopProductId, variationId) {
    return ProductAddOn.findAll({
      where: variationId
        ? { variationId, isRequired: true, isActive: true }
        : { shopProductId, isRequired: true, isActive: true },
      include: [{ model: ProductAddOnImage, as: "images", attributes: ["id", "url", "thumbnailUrl"] }],
    });
  }

  async createLine(data, transaction) {
    return ProductCartItem.create(data, { transaction });
  }

  // Runs find-existing-line + create/update inside one transaction with a row
  // lock, so two near-simultaneous add-to-cart requests for the same product
  // (e.g. a double-tap) can't both read "no existing line" and each insert
  // their own row — the second waits for the first to commit, then sees it
  // and increments instead of duplicating.
  async withCartLineLock(userId, shopProductId, variationId, fn) {
    return sequelize.transaction(async (t) => {
      const existing = await ProductCartItem.findOne({
        where: { userId, shopProductId, variationId: variationId ?? null },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      return fn(existing, t);
    });
  }

  async findUserLine(userId, cartItemId) {
    return ProductCartItem.findOne({ where: { id: cartItemId, userId } });
  }

  async listUserLines(userId) {
    return ProductCartItem.findAll({
      where: { userId },
      include: [
        {
          model: ShopProduct,
          as: "product",
          attributes: [
            "id",
            "name",
            "hasVariations",
            "pricing_type",
            "price",
            "min_price",
            "max_price",
            "quantity",
            "shopId",
          ],
          include: [
            {
              model: ProductImage,
              as: "productImages",
              attributes: ["id", "url", "thumbnailUrl"],
            },
          ],
        },
        {
          model: ProductVariation,
          as: "variation",
          attributes: [
            "id",
            "name",
            "sizeSpec",
            "unit",
            "price",
            "inStock",
            "stock",
            "stockMinOrder",
            "byOrder",
            "byOrderMinOrder",
          ],
          include: [
            {
              model: ProductVariationImage,
              as: "images",
              attributes: ["id", "url", "thumbnailUrl"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async saveLine(line, fields, transaction) {
    return line.update(fields, { transaction });
  }

  async deleteLine(userId, cartItemId) {
    const line = await this.findUserLine(userId, cartItemId);
    if (!line) throw new CustomError("Cart item not found", 404);
    await line.destroy();
    return line;
  }

  async deleteLines(userId, cartItemIds) {
    return ProductCartItem.destroy({ where: { id: cartItemIds, userId } });
  }

  async clearCart(userId) {
    return ProductCartItem.destroy({ where: { userId } });
  }
}

module.exports = ProductCartRepository;
