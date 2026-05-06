// models/walletTransaction.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

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
    receiptId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM(
        "DEPOSIT",
        "WITHDRAW",
        "LOCK",
        "UNLOCK",
        "TRANSFER",
        "CONVERT"
      ),
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
    performedBy: {
      allowNull: true,
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
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
      { fields: ["createdAt"] },
      { fields: ["walletId", "createdAt"] },
      { fields: ["userId", "createdAt"] },
    ],
  }
);

module.exports = WalletTransaction;
