const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user')

const Company = sequelize.define('Company', {
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: DataTypes.INTEGER
  },
  companyName: {
    allowNull: true,
    type: DataTypes.STRING
  },
  managerFirstName: {
    allowNull: true,
    type: DataTypes.STRING
  },
  managerLastName: {
    allowNull: true,
    type: DataTypes.STRING
  },
  companyPhone: {
    allowNull: true,
    type: DataTypes.STRING
  },
  companyAddress: {
    allowNull: true,
    type: DataTypes.STRING
  },
  companyCountry: {
    allowNull: true,
    type: DataTypes.STRING
  },
  companyCity: {
    allowNull: true,
    type: DataTypes.STRING
  },
  companyZip: {
    allowNull: true,
    type: DataTypes.STRING
  },
  deliveryAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryCountry: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryCity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  deliveryZip: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userId: {
    allowNull: false,
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  createdAt: {
    allowNull: false,
    type: DataTypes.DATE
  },
  updatedAt: {
    allowNull: false,
    type: DataTypes.DATE
  }
}, {
  tableName: 'companies' // Specify the table name
})

// Define the association with User
Company.belongsTo(User, { foreignKey: 'userId' })

module.exports = Company
