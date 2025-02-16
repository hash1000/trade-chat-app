const { DataTypes } = require('sequelize');
const db = require('../config/database');
const User = require('./user');

const Order = db.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    allowNull: false,
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('WAITING', 'PAYED', 'SHIPPED'),
    allowNull: false,
    defaultValue: 'WAITING'
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  image: {
    type: DataTypes.STRING,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false
  },
  orderNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  createdAt: {
    allowNull: false,
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    allowNull: false,
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, { tableName: 'orders' });


module.exports = Order;
