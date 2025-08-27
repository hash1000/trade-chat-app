const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust path as needed

const Version = sequelize.define('Version', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'versions',
  timestamps: true,
});

module.exports = Version;