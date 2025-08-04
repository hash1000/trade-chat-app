// models/PeerTransferRequest.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user');

const PeerTransferRequest = sequelize.define('peerTransferRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users', // Table name, not model name
      key: 'id',
    },
  },
  requesteeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("pending", "accepted", "declined", "cancelled"),
    allowNull: false,
    defaultValue: "pending",
  },
  message: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'payment_requests',
  timestamps: true,
});

// Relationships
PeerTransferRequest.belongsTo(User, { as: 'requester', foreignKey: 'requesterId' });
PeerTransferRequest.belongsTo(User, { as: 'requestee', foreignKey: 'requesteeId' });

module.exports = PeerTransferRequest;
