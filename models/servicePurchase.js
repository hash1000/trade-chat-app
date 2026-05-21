// models/servicePurchase.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// models/servicePurchase.js

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
      comment: "Buyer",
    },

    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    buyerWalletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    sellerWalletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    walletTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    amountPaid: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "PENDING",
        "COMPLETED",
        "REFUNDED"
      ),
      allowNull: false,
      defaultValue: "COMPLETED",
    },
  },
  {
    tableName: "service_purchases",

    indexes: [
      { fields: ["userId"] },
      { fields: ["serviceId"] },

      {
        unique: true,
        fields: ["userId", "serviceId"],
      },

      { fields: ["buyerWalletId"] },
      { fields: ["sellerWalletId"] },

      { fields: ["walletTransactionId"] },
    ],
  }
);

module.exports = ServicePurchase;