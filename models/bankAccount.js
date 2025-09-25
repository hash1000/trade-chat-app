// models/BankAccount.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankAccount = sequelize.define(
  'BankAccount',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    accountName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    iban: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    accountHolder: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    accountCurrency: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    bicSwift: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
    tableName: 'bank_accounts',
  }
);

module.exports = BankAccount;
