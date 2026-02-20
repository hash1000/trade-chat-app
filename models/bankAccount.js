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
      allowNull: true,
      unique: false,
      defaultValue: null,
    },
    swift_code: {
      type: DataTypes.STRING,
      allowNull: false
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
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // classification: indicates whether this account is used for sending, receiving or both
    classification: {
      type: DataTypes.ENUM('sender', 'receiver', 'both'),
      allowNull: false,
      defaultValue: 'both',
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
