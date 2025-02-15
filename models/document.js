const { DataTypes } = require('sequelize');
const db = require('../config/database');

const Document = db.define('Document', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  document: {
    type: DataTypes.JSON,
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
