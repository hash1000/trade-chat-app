// models/servicePurchase.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicePurchase = sequelize.define(
  "ServicePurchase",
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
    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    walletTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amountPaid: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    },
    status: {
      type: DataTypes.ENUM("PENDING", "COMPLETED", "REFUNDED"),
      allowNull: false,
      defaultValue: "COMPLETED",
    },
  },
  {
    tableName: "service_purchases",
    indexes: [
      { fields: ["userId"] },
      { fields: ["serviceId"] },
      { fields: ["userId", "serviceId"] },
    ],
  }
);

module.exports = ServicePurchase;