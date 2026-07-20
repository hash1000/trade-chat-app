const { DataTypes } = require("sequelize");
const db = require("../config/database");

const ProductCartItem = db.define(
  "ProductCartItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Only set when the product sells through variations (hasVariations: true).
    variationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    // Unit price frozen at add-time — sourced from ProductVariation.price when
    // variationId is set, otherwise from ShopProduct.price.
    unitPriceSnapshot: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    discountCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    discountPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "product_cart_items",
    timestamps: true,
  }
);

module.exports = ProductCartItem;
