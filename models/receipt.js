// models/receipt.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Receipt = sequelize.define(
  'Receipt',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    receiverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(20, 5),
      allowNull: false,
      defaultValue: 0,
    },
    newAmount: {
      type: DataTypes.DECIMAL(20, 5),
      allowNull: true,
      defaultValue: null,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    approvedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    }
  },
  {
    timestamps: true,
    tableName: 'receipts',
  }
);


  module.exports = Receipt;
