const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ProductOrderItem = sequelize.define(
  'ProductOrderItem',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    variationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    unitPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: 'productOrderItems',
  }
)

module.exports = ProductOrderItem
