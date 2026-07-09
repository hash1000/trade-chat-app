const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ProductAccess = sequelize.define(
  'ProductAccess',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('owner', 'editor', 'viewer'),
      allowNull: false,
      defaultValue: 'editor',
    },
  },
  {
    timestamps: true,
    tableName: 'productAccesses',
  }
)

module.exports = ProductAccess
