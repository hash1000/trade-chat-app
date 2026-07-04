const { DataTypes } = require("sequelize");
const db = require("../config/database");

const OrderPayment = db.define(
  "OrderPayment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    serviceOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("order_payment", "order_top_up"),
      allowNull: false,
      defaultValue: "order_payment",
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { tableName: "order_payments" }
);

module.exports = OrderPayment;
