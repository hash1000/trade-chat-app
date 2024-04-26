// Assuming you have a Sequelize instance named 'sequelize' initialized and a 'User' model for the users table
const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

const Card = sequelize.define('Card', {
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
  expiry: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastFourDigits: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  tableName: 'cards',
  timestamps: true
})

module.exports = Card
