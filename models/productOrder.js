const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ProductOrder = sequelize.define(
  'ProductOrder',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    orderNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'unpaid', 'active', 'in_production', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
    },
    total: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'productOrders',
  }
)

module.exports = ProductOrder
