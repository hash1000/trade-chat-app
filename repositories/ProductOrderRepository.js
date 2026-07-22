const {
  ProductOrder,
  ProductShopOrder,
  ProductShopOrderItem,
  ProductShopOrderCharge,
  ShopProduct,
  ProductVariation,
  ProductImage,
  ProductVariationImage,
  Shop,
  Address,
  Wallet,
  User,
} = require("../models");
const sequelize = require("../config/database");
const CustomError = require("../errors/CustomError");

const BUYER_ATTRIBUTES = ["id", "username", "email", "firstName", "lastName", "profilePic", "phoneNumber"];

function itemInclude() {
  return [
    {
      model: ShopProduct,
      as: "product",
      attributes: ["id", "name", "hasVariations", "shopId"],
      include: [{ model: ProductImage, as: "productImages", attributes: ["id", "url", "thumbnailUrl"] }],
    },
    {
      model: ProductVariation,
      as: "variation",
      attributes: ["id", "name", "sizeSpec", "unit"],
      include: [{ model: ProductVariationImage, as: "images", attributes: ["id", "url", "thumbnailUrl"] }],
    },
  ];
}

function shopOrderInclude() {
  return [
    { model: ProductShopOrderItem, as: "items", include: itemInclude() },
    { model: ProductShopOrderCharge, as: "charges", order: [["id", "ASC"]] },
    {
      model: Shop,
      as: "shop",
      attributes: ["id", "name", "profile_image", "country"],
      include: [{ model: User, as: "user", attributes: BUYER_ATTRIBUTES }],
    },
    { model: User, as: "buyer", attributes: BUYER_ATTRIBUTES },
  ];
}

class ProductOrderRepository {
  async fetchAddress(addressId, userId) {
    return Address.findOne({ where: { id: addressId, userId } });
  }

  async fetchWallet(userId, walletType) {
    return Wallet.findOne({ where: { userId, walletType } });
  }

  async fetchWalletById(walletId) {
    return Wallet.findByPk(walletId);
  }

  async fetchShop(shopId) {
    return Shop.findByPk(shopId);
  }

  async createParentOrder(data, transaction) {
    return ProductOrder.create(data, { transaction });
  }

  async createShopOrder(data, transaction) {
    return ProductShopOrder.create(data, { transaction });
  }

  async createShopOrderItems(rows, transaction) {
    return ProductShopOrderItem.bulkCreate(rows, { transaction });
  }

  async findParentOrder(parentOrderId) {
    return ProductOrder.findByPk(parentOrderId, {
      include: [
        { model: Address, as: "address" },
        { model: User, as: "buyer", attributes: BUYER_ATTRIBUTES },
        { model: ProductShopOrder, as: "shopOrders", include: shopOrderInclude() },
      ],
    });
  }

  async findParentOrderForUser(parentOrderId, userId) {
    return ProductOrder.findOne({
      where: { id: parentOrderId, userId },
      include: [
        { model: Address, as: "address" },
        { model: User, as: "buyer", attributes: BUYER_ATTRIBUTES },
        { model: ProductShopOrder, as: "shopOrders", include: shopOrderInclude() },
      ],
    });
  }

  async listParentOrdersForBuyer(userId, { page, limit }) {
    const offset = (page - 1) * limit;
    const { count, rows } = await ProductOrder.findAndCountAll({
      where: { userId },
      include: [
        { model: Address, as: "address" },
        { model: User, as: "buyer", attributes: BUYER_ATTRIBUTES },
        { model: ProductShopOrder, as: "shopOrders", include: shopOrderInclude() },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });
    return { total: count, rows };
  }

  async findShopOrder(shopOrderId) {
    return ProductShopOrder.findByPk(shopOrderId, { include: shopOrderInclude() });
  }

  async findShopOrderForOwnerCheck(shopOrderId) {
    return ProductShopOrder.findByPk(shopOrderId);
  }

  async listShopOrdersForShop(shopId, { page, limit, status }) {
    const offset = (page - 1) * limit;
    const where = { shopId };
    if (status) where.status = status;

    const { count, rows } = await ProductShopOrder.findAndCountAll({
      where,
      include: shopOrderInclude(),
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });
    return { total: count, rows };
  }

  // Orders across every shop the given user owns, not just one.
  // Resolves owned shopIds first and filters on that plain column rather than
  // a where/required on the nested "shop" include — combined with the doubly
  // nested shop.user include, Sequelize's findAndCountAll count-subquery drops
  // the join alias and errors with "Unknown column 'shop.userId' in 'on clause'".
  async listShopOrdersForOwner(ownerUserId, { page, limit, status }) {
    const offset = (page - 1) * limit;

    const ownedShops = await Shop.findAll({ where: { userId: ownerUserId }, attributes: ["id"] });
    const shopIds = ownedShops.map((s) => s.id);
    if (shopIds.length === 0) {
      return { total: 0, rows: [] };
    }

    const where = { shopId: shopIds };
    if (status) where.status = status;

    const { count, rows } = await ProductShopOrder.findAndCountAll({
      where,
      include: shopOrderInclude(),
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      distinct: true,
    });
    return { total: count, rows };
  }

  async updateShopOrder(shopOrderId, fields, transaction) {
    return ProductShopOrder.update(fields, { where: { id: shopOrderId }, transaction });
  }

  // fields: { columnName: numericDelta }. Column names are always our own
  // hardcoded constants (never derived from request input), so building the
  // literal this way is safe.
  async incrementShopOrderTotals(shopOrderId, fields, transaction) {
    const literalFields = {};
    for (const [key, delta] of Object.entries(fields)) {
      literalFields[key] = sequelize.literal(`\`${key}\` + ${delta}`);
    }
    return ProductShopOrder.update(literalFields, { where: { id: shopOrderId }, transaction });
  }

  async createCharge(data, transaction) {
    return ProductShopOrderCharge.create(data, { transaction });
  }

  async findChargeOrFail(chargeId) {
    const charge = await ProductShopOrderCharge.findByPk(chargeId);
    if (!charge) throw new CustomError("Charge not found", 404);
    return charge;
  }

  async markChargePaid(chargeId, transaction) {
    return ProductShopOrderCharge.update(
      { isPaid: true, paidAt: new Date() },
      { where: { id: chargeId }, transaction }
    );
  }
}

module.exports = ProductOrderRepository;
