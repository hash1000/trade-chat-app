// models/walletTransaction.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");
const Wallet = require("./wallet");
const Receipt = require("./receipt");

const WalletTransaction = sequelize.define(
  "WalletTransaction",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    walletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "FX_CONVERT_IN",
        "FX_CONVERT_OUT",
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
    balanceBefore: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "wallet_transactions",
  },
);

WalletTransaction.belongsTo(Wallet, { foreignKey: "walletId", as: "wallet" });
WalletTransaction.belongsTo(User, { foreignKey: "userId", as: "user" });
WalletTransaction.belongsTo(Receipt, { foreignKey: "receiptId", as: "receipt" });

module.exports = WalletTransaction;