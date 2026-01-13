const ShopProduct = require("../models/shopProduct");
const { Op } = require("sequelize");
const CustomError = require("../errors/CustomError");
const Shop = require("../models/shop");
const ProductImage = require("../models/productImage");

class ShopProductRepository {
  async createProduct(data, transaction) {
    return ShopProduct.create(data, { transaction });
  }

  async updateProduct(productId, productData) {
    const product = await ShopProduct.findByPk(productId);
    if (!product) throw new CustomError("Product not found", 404);

    return product.update(productData);
  }

  async deleteProduct(productId) {
    const product = await ShopProduct.findByPk(productId);
    if (!product) throw new CustomError("Product not found", 404);
    return product.destroy();
  }

  async getById(productId) {
    const product = await ShopProduct.findOne({
      where: { id: productId }, // Ensure you're querying the correct product ID
      include: [
        {
          model: ProductImage,
          as: "productImages", // Use the alias defined in the association
        },
      ],
    });
    if (!product) throw new CustomError("Product not found", 404);
    return product;
  }

  async getByShopId(shopId) {
    const product = await ShopProduct.findAll({
      where: { shopId }, // Ensure you're querying the correct product ID
      include: [
        {
          model: ProductImage,
          as: "productImages", // Use the alias defined in the association
        },
      ],
    });
    return product;
  }

  async getProductById(productId, userId) {
    const product = await ShopProduct.findByPk(productId);
    if (!product) throw new CustomError("Product not found", 404);

    const shop = await Shop.findByPk(product.shopId);
    if (shop.userId !== userId) {
      throw new CustomError("Unauthorized", 403);
    }

    return product;
  }

  async getPaginatedProducts(page, limit, name, shopId) {
    const offset = (page - 1) * limit;
    const where = {};

    if (name) {
      where.name = { [Op.like]: `%${name}%` };
    }

    if (shopId) {
      where.shopId = shopId;
    }

    const { count, rows } = await ShopProduct.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      products: rows,
    };
  }
}

module.exports = ShopProductRepository;
