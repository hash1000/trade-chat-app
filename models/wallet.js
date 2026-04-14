// models/wallet.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Wallet = sequelize.define(
  "Wallet",
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
    currency: {
      // "USD", "EUR", "CNY", etc.
      type: DataTypes.STRING(3),
      allowNull: false,
    },
    walletType: {
      // "PERSONAL", "COMPANY", more types in future
      type: DataTypes.ENUM("PERSONAL", "COMPANY"),
      allowNull: false,
      defaultValue: "PERSONAL",
    },
    availableBalance: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    lockedBalance: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
    },
    accountNumber: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: false,
    },
  },
  {
    tableName: "wallets",
    indexes: [
      {
        unique: true,
        fields: ["userId", "currency", "walletType"],
      },
      {
        unique: true,
        fields: ["accountNumber"],
      },
    ],
  },
);

module.exports = Wallet;
