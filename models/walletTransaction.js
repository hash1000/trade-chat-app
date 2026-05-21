// models/walletTransaction.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WalletTransaction = sequelize.define(
  "WalletTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    transaction_group_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    walletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM("DEPOSIT", "WITHDRAW", "LOCK", "UNLOCK", "TRANSFER", "CONVERT"),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    referenceType: {
      // What business entity caused this transaction
      // Only 'SERVICE_PURCHASE' for now
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    referenceId: {
      // PK of the row in the business table (service_purchases.id)
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    receiptId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    performedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "wallet_transactions",
    indexes: [
      { fields: ["transaction_group_id"] },
      { fields: ["walletId"] },
      { fields: ["userId"] },
      { fields: ["receiptId"] },
      { fields: ["referenceType", "referenceId"] },  // ← lookup both together
      { fields: ["createdAt"] },
      { fields: ["walletId", "createdAt"] },
      { fields: ["userId", "createdAt"] },
    ],
  }
);

module.exports = WalletTransaction;