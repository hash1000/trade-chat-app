// Assuming you have a Sequelize instance named 'sequelize' initialized and a 'User' model for the users table
const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'carts',
  timestamps: true
})

module.exports = Cart
