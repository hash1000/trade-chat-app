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
    bic: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    intermediateBank: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
    beneficiaryAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'bank_accounts',
  }
);

module.exports = BankAccount;
