const { DataTypes } = require("sequelize");
const db = require("../config/database");

const ServiceOrder = db.define(
  "ServiceOrder",
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
    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    serviceOwnerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    servicePriceAtOrder: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    discountCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    discountPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    finalAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENDING", "PURCHASED", "REFUNDED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "service_orders" }
);

module.exports = ServiceOrder;
