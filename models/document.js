const { DataTypes } = require('sequelize');
const db = require('../config/database');

const Document = db.define('Document', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderNo: {
    type: DataTypes.STRING, // Must match Order model's orderNo type
    allowNull: false,
    references: {
      model: 'Order',
      key: 'orderNo'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  document: {
    type: DataTypes.STRING,
    allowNull: false
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
}, { tableName: 'documents' });

module.exports = Document;
