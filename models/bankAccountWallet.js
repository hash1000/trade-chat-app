const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const BankAccountWallet = sequelize.define(
  "BankAccountWallet",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    walletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
  },
  {
    tableName: "bank_account_wallets",
    timestamps: true,
  }
);

module.exports = BankAccountWallet;