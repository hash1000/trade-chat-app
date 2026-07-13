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
