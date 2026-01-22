const Shop = require("../models/shop");
const { Op } = require("sequelize");
const CustomError = require("../errors/CustomError");
const ShopProduct = require("../models/shopProduct");
const ProductImage = require("../models/productImage");

class ShopRepository {
  async createShop(data) {
    return Shop.create(data);
  }

  async updateShop(shopId, shopData) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    return shop.update(shopData);
  }

  async deleteShop(shopId) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);

    return shop.destroy();
  }

  async getShopById(shopId) {
    const shop = await Shop.findByPk(shopId);
    if (!shop) throw new CustomError("Shop not found", 404);
    return shop;
  }

  async getByUserId(userId) {
    return Shop.findAll({
      where: { userId },
      include: [
        {
          model: ShopProduct,
          as: "shopProducts",
          include: [
            {
              model: ProductImage,
              as: "productImages",
            },
          ],
        },
      ],
    });
  }

  async getById(userId, id) {
    return Shop.findAll({
      where: { id, userId },
      include: [
        {
          model: ShopProduct,
          as: "shopProducts",
          include: [
            {
              model: ProductImage,
              as: "productImages",
            },
          ],
        },
      ],
    });
  }

  async getPaginatedShops(page, limit, shop_name, country) {
    const offset = (page - 1) * limit;
    const where = {};

    if (shop_name) {
      where.shop_name = { [Op.like]: `%${shop_name}%` };
    }

    if (country) {
      where.country = { [Op.like]: `%${country}%` };
    }

    const { count, rows } = await Shop.findAndCountAll({
      where,
      limit: Number(limit),
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      total: count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      shops: rows,
    };
  }
}

module.exports = ShopRepository;
