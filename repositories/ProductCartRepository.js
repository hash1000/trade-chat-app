const {
  ProductCartItem,
  ShopProduct,
  ProductVariation,
  ProductImage,
  ProductVariationImage,
  ProductAddOn,
} = require("../models");
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
  async fetchAddOns(addOnIds, shopProductId, variationId) {
    return ProductAddOn.findAll({
      where: variationId
        ? { id: addOnIds, variationId }
        : { id: addOnIds, shopProductId },
    });
  }

  async findExistingLine(userId, shopProductId, variationId) {
    return ProductCartItem.findOne({
      where: { userId, shopProductId, variationId: variationId ?? null },
    });
  }

  async createLine(data) {
    return ProductCartItem.create(data);
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

  async saveLine(line, fields) {
    return line.update(fields);
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
