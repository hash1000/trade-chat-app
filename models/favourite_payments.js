const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user')
const PaymentRequest = require('./payment_request')

const FavouritePayment = sequelize.define('FavouritePayment', {
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: DataTypes.INTEGER
  },
  userId: {
    allowNull: false,
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  paymentId: {
    allowNull: false,
    type: DataTypes.INTEGER,
    references: {
      model: PaymentRequest,
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
    modelName: 'FavouritePayment',
    tableName: 'favourite_payments'
  })

// Define the association with User
FavouritePayment.belongsTo(User, { foreignKey: 'userId' })
FavouritePayment.belongsTo(PaymentRequest, { foreignKey: 'paymentId' })

module.exports = FavouritePayment
