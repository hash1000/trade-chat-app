const { DataTypes } = require('sequelize')
const db = require('../config/database')
const User = require('./user')
const OrderProduct = require('./order_products')

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
    defaultValue: 1
  },
  image: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.STRING,
    allowNull: false
  },
  orderNo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdAt: {
    allowNull: false,
    type: DataTypes.DATE
  },
  updatedAt: {
    allowNull: false,
    type: DataTypes.DATE
  }
}, { tableName: 'orders' })

// Order.hasMany(OrderProduct, {
//   foreignKey: 'orderId',
//   as: 'orderProducts'
// })
// Order.belongsToMany(Product, {
//     through: OrderProduct,
//     as: 'products',
//     foreignKey: 'orderId'
// });

module.exports = Order
