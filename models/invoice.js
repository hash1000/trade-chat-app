const { DataTypes } = require('sequelize')
const sequelize = require('../config/database') // Assuming you have a Sequelize instance named 'sequelize'
const { v4: uuidv4 } = require('uuid')
const User = require('./user')

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'COMMERCIAL INVOICE'
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'COMMERCIAL INVOICE'
  },
  userId: {
    allowNull: false,
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  number: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: () => uuidv4()
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  bundle: {
    type: DataTypes.JSON,
    allowNull: true
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0

  },
  deliveryTerm: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'EX WORKS'
  },
  paymentTerm: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'By Bank'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'invoices' // Assuming the table name is 'invoices'
})

module.exports = Invoice
