// models/withdraw.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Withdraw = sequelize.define(
  'Withdraw',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    bankCardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(20, 5),
      allowNull: false,
      defaultValue: 0,
    },
    // Actual amount the admin paid out (like receipt newAmount). Record only —
    // the wallet is never re-adjusted from this value.
    newAmount: {
      type: DataTypes.DECIMAL(20, 5),
      allowNull: true,
      defaultValue: null,
    },
    currency: {
      type: DataTypes.STRING(3), // "USD", "EUR", "CNY", ...
      allowNull: false,
      defaultValue: 'USD',
    },
    walletType: {
      type: DataTypes.ENUM('PERSONAL', 'COMPANY'),
      allowNull: false,
      defaultValue: 'PERSONAL',
    },
    note: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    // Note the admin attached when paying/refunding
    adminNote: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // Admin/accountant who paid or refunded this withdraw
    processedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Amount is deducted from the wallet at creation, so the user side is
    // immediately "success"; it follows the admin decision afterwards.
    userStatus: {
      type: DataTypes.ENUM('success', 'paid', 'refunded'),
      allowNull: false,
      defaultValue: 'success',
    },
    adminStatus: {
      type: DataTypes.ENUM('pending', 'paid', 'refunded'),
      allowNull: false,
      defaultValue: 'pending',
    },
  },
  {
    timestamps: true,
    paranoid: true, // soft delete via deletedAt
    tableName: 'withdraws',
  }
);

module.exports = Withdraw;
