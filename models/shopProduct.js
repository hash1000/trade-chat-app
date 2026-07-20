const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ShopProduct = sequelize.define(
  'ShopProduct',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // When true the product sells through its variations: it holds no price of
    // its own, and pricing_type/price/min_price/max_price are derived from them.
    hasVariations: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pricing_type: {
      type: DataTypes.ENUM("free", "fixed", "range"),
      allowNull: false,
      defaultValue: "fixed",
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    min_price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    max_price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    // legacy plain rating — superseded by per-user ratings (ratingAvg/ratingCount)
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    // How many units have been sold in total. Only meaningful when
    // hasVariations is false — variation products track this per-variation
    // (see ProductVariation.soldQuantity) instead.
    soldQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    // draft: seller still editing, hidden from buyers.
    // published: live and visible/purchasable.
    // archived: seller pulled it, hidden but kept for history.
    // "out_of_stock" is NOT stored here — it's derived on read from quantity/stock
    // hitting 0 so it can never drift out of sync (see ShopProductService.effectiveStatus).
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
    insured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    moneyBack: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    support247: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isTopChoice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isQRMVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ratingAvg: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0,
    },
    ratingCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    baseViewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    baseLikeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'shopProducts',
  }
)

module.exports = ShopProduct
