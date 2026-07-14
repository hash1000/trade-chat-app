const ShopProduct = require("../models/shopProduct");
const { Op } = require("sequelize");
const sequelize = require("../config/database");
const CustomError = require("../errors/CustomError");
const Shop = require("../models/shop");
const ProductImage = require("../models/productImage");
const ProductLike = require("../models/productLike");
const ProductRating = require("../models/productRating");
const ProductView = require("../models/productView");
const ProductFile = require("../models/productFile");
const ProductVariation = require("../models/productVariation");
const ProductVariationImage = require("../models/productVariationImage");
const ProductCategory = require("../models/productCategory");
const PublicCategory = require("../models/publicCategories");

class ShopProductRepository {
  _publicInclude() {
    return [
      {
        model: ProductImage,
        as: "productImages",
      },
      {
        model: ProductFile,
        as: "media",
      },
      {
        model: ProductVariation,
        as: "variations",
        include: [{ model: ProductVariationImage, as: "images" }],
      },
      {
        model: PublicCategory,
        as: "categories",
        through: { attributes: [] },
      },
      {
        model: Shop,
        as: "shop",
        attributes: [
          "id",
          "name",
          "profile_image",
          "header_image",
          "description",
          "country",
          "likes",
          "rating",
          "createdAt",
          "updatedAt",
        ],
      },
    ];
  }

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
        {
          model: ProductFile,
          as: "media",
        },
        {
          model: ProductVariation,
          as: "variations",
          include: [{ model: ProductVariationImage, as: "images" }],
        },
        {
          model: PublicCategory,
          as: "categories",
          through: { attributes: [] },
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

  async getPublicById(productId) {
    const product = await ShopProduct.findOne({
      where: { id: productId },
      include: this._publicInclude(),
    });

    if (!product) throw new CustomError("Product not found", 404);
    return product;
  }

  async getPublicByShopId(shopId) {
    return ShopProduct.findAll({
      where: { shopId },
      include: this._publicInclude(),
      order: [["createdAt", "DESC"]],
    });
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

  async getMyPaginatedProducts(userId, page, limit, name, shopId) {
    const offset = (page - 1) * limit;
    const where = {};

    if (name) {
      where.name = { [Op.like]: `%${name}%` };
    }

    if (shopId) {
      where.shopId = shopId;
    }

    // the required shop join is what keeps other owners' products out
    const include = this._publicInclude().map((association) =>
      association.as === "shop"
        ? { ...association, where: { userId }, required: true }
        : association
    );

    const { count, rows } = await ShopProduct.findAndCountAll({
      where,
      include,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      products: rows,
    };
  }

  async getPublicPaginatedProducts(page, limit, name, shopId) {
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
      include: this._publicInclude(),
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      products: rows,
    };
  }

  // ── Likes ────────────────────────────────────────────────────────────────

  async likeProduct(userId, shopProductId) {
    const [like, created] = await ProductLike.findOrCreate({
      where: { userId, shopProductId },
      defaults: { userId, shopProductId },
    });
    return { like, created };
  }

  async unlikeProduct(userId, shopProductId) {
    const deleted = await ProductLike.destroy({ where: { userId, shopProductId } });
    return deleted > 0;
  }

  async getLikesCount(shopProductId) {
    return ProductLike.count({ where: { shopProductId } });
  }

  async hasUserLiked(userId, shopProductId) {
    const like = await ProductLike.findOne({ where: { userId, shopProductId } });
    return like !== null;
  }

  // ── Views ────────────────────────────────────────────────────────────────

  async recordView(userId, shopProductId) {
    const [view, created] = await ProductView.findOrCreate({
      where: { userId, shopProductId },
      defaults: { userId, shopProductId },
    });
    return { view, created };
  }

  async getViewsCount(shopProductId) {
    return ProductView.count({ where: { shopProductId } });
  }

  // ── Ratings (per-user 0-10, keeps ratingAvg/ratingCount in sync) ──────────

  async upsertRating(userId, shopProductId, rating, comment, t) {
    const existing = await ProductRating.findOne({
      where: { userId, shopProductId },
      transaction: t,
    });

    if (existing) {
      await existing.update(
        { rating, ...(comment !== undefined && { comment }) },
        { transaction: t },
      );
    } else {
      await ProductRating.create(
        { userId, shopProductId, rating, comment: comment ?? null },
        { transaction: t },
      );
    }

    await this._recomputeRating(shopProductId, t);
    return true;
  }

  async deleteRating(userId, shopProductId, t) {
    const deleted = await ProductRating.destroy({
      where: { userId, shopProductId },
      transaction: t,
    });

    if (deleted > 0) {
      await this._recomputeRating(shopProductId, t);
    }

    return deleted > 0;
  }

  async _recomputeRating(shopProductId, t) {
    const [result] = await sequelize.query(
      `SELECT COUNT(*) AS cnt, AVG(rating) AS avg FROM product_ratings WHERE shopProductId = :shopProductId`,
      {
        replacements: { shopProductId },
        type: sequelize.QueryTypes.SELECT,
        transaction: t,
      },
    );

    const count = parseInt(result.cnt, 10) || 0;
    const avg = count > 0 ? parseFloat(parseFloat(result.avg).toFixed(2)) : 0;

    await ShopProduct.update(
      { ratingCount: count, ratingAvg: avg },
      { where: { id: shopProductId }, transaction: t },
    );
  }

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories(shopProductId) {
    const rows = await ProductCategory.findAll({
      where: { shopProductId },
      include: [{ model: PublicCategory, as: "category" }],
    });
    return rows;
  }

  async addCategories(shopProductId, categoryIds) {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) return [];

    const numericIds = [
      ...new Set(
        categoryIds
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id) && id > 0),
      ),
    ];
    if (numericIds.length === 0) return [];

    const existing = await PublicCategory.findAll({
      where: { id: { [Op.in]: numericIds } },
      attributes: ["id"],
    });
    const existingIds = new Set(existing.map((c) => c.id));
    const missingIds = numericIds.filter((id) => !existingIds.has(id));
    if (missingIds.length > 0) {
      throw new CustomError(`Category(ies) not found: ${missingIds.join(", ")}`, 404);
    }

    await Promise.all(
      numericIds.map((publicCategoryId) =>
        ProductCategory.findOrCreate({
          where: { shopProductId, publicCategoryId },
          defaults: { shopProductId, publicCategoryId },
        }),
      ),
    );

    return numericIds;
  }

  async removeCategory(shopProductId, publicCategoryId) {
    const deleted = await ProductCategory.destroy({
      where: { shopProductId, publicCategoryId },
    });
    return deleted > 0;
  }

  async removeAllCategories(shopProductId) {
    await ProductCategory.destroy({ where: { shopProductId } });
  }

  // ── Admin badges ──────────────────────────────────────────────────────────

  async updateBadges(shopProductId, data) {
    const product = await ShopProduct.findByPk(shopProductId);
    if (!product) return null;
    await product.update(data);
    return product;
  }
}

module.exports = ShopProductRepository;
