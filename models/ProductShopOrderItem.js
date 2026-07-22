const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// One product/variation line within a shop-order — a straight copy of the
// ProductCartItem it came from at checkout time (price, discount, add-ons all
// frozen as-is, no re-validation). See ProductCartItem for field meanings.
const ProductShopOrderItem = sequelize.define(
  "ProductShopOrderItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    variationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    productCartItemQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
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
    // Copied verbatim from ProductCartItem.addOns — [{ addOnId, name, price, image }].
    addOns: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    // unitPriceSnapshot * productCartItemQuantity - discountAmount + sum(addOns[].price)
    subtotal: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "product_shop_order_items",
    timestamps: true,
  }
);

module.exports = ProductShopOrderItem;
