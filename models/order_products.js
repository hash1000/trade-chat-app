const { DataTypes } = require('sequelize')
const db = require('../config/database')
const Product = require('./product')

const OrderProduct = db.define('OrderProduct', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  modelName: 'OrderProduct',
  tableName: 'order_products'
})

OrderProduct.belongsTo(Product, { foreignKey: 'productId' })

module.exports = OrderProduct
