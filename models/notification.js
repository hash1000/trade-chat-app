// models/notification.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define(
  'Notification',
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    // recipient
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // who triggered it (user who created the receipt, admin who approved, ...)
    actorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    type: {
      // RECEIPT_CREATED, RECEIPT_APPROVED, RECEIPT_REJECTED, RECEIPT_LOCKED,
      // RECEIPT_UNLOCKED, RECEIPT_UPDATED, RECEIPT_DELETED,
      // WITHDRAW_CREATED, WITHDRAW_PAID, WITHDRAW_REFUNDED, WITHDRAW_DELETED,
      // SERVICE_ORDER_CREATED, SERVICE_ORDER_PURCHASED, ...
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // what the notification is about, for client navigation
    entityType: {
      type: DataTypes.STRING(50), // RECEIPT | WITHDRAW | SERVICE_ORDER | ORDER
      allowNull: true,
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // extra details for the client (amount, currency, status, actorName, ...)
    data: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    tableName: 'notifications',
    indexes: [
      { fields: ['userId', 'createdAt'] },
      { fields: ['userId', 'isRead'] },
      { fields: ['entityType', 'entityId'] },
    ],
  }
);

module.exports = Notification;
