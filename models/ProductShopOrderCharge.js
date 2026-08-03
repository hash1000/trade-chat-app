const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// A post-order charge the shop owner (or admin) adds against an already-placed
// shop-order — e.g. international shipping/transport once the real cost is known.
// Adding one only raises the shop-order's totalAmount (a balance becomes due); no
// wallet movement happens until the buyer explicitly pays it via payCharge.
const ProductShopOrderCharge = sequelize.define(
  "ProductShopOrderCharge",
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
    // Optional: when set, this charge is billing for a specific catalog add-on
    // (must belong to a product/variation actually in this shop-order's items)
    // rather than a freeform fee like shipping. name/amount are always copied
    // from the ProductAddOn at add-time, not independently settable.
    addOnId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    // Only meaningful when addOnId is set — how many units of that add-on this
    // charge covers. amount = addOn.price * quantity. Always 1 for freeform
    // (name/amount) charges.
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    addedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "product_shop_order_charges",
    timestamps: true,
  }
);

module.exports = ProductShopOrderCharge;
