const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// One shop's slice of a checkout — e.g. parent order #1001 splits into shop-orders
// #1001-1 (Shop A), #1001-2 (Shop B). Each has its own status/lifecycle/payout —
// one shop shipping has no bearing on another shop's shop-order in the same
// checkout. This is the row a seller actually manages.
const ProductShopOrder = sequelize.define(
  "ProductShopOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    parentOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Denormalized from the parent for query convenience (buyer's own order list
    // filters directly on this without a join back to product_orders).
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "confirmed",
        "processing",
        "shipped",
        "in_transit",
        "customs",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
        "returned"
      ),
      allowNull: false,
      defaultValue: "confirmed",
    },
    // Sum of line items' subtotal (before discount).
    subtotal: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    // Sum of line items' discountAmount.
    discountAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    // Sum of add-on (line-item) prices — never discounted, mirrors the cart rule.
    addOnAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    // Sum of post-order ProductShopOrderCharge rows (e.g. shipping) added so far.
    chargesAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    // subtotal - discountAmount + addOnAmount + chargesAmount
    totalAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    // How much of totalAmount has actually been paid so far (checkout pays
    // subtotal-discountAmount+addOnAmount immediately; chargesAmount is paid
    // later via the pay-charge endpoint, so paidAmount can trail totalAmount).
    paidAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    // Snapshot of which wallet actually received the checkout payout, so a later
    // refund credits back the exact same wallet even if the shop reconfigures
    // payoutWalletId afterward.
    payoutWalletId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "product_shop_orders",
    timestamps: true,
  }
);

module.exports = ProductShopOrder;
