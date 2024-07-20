const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')
const User = require('./user')

const PaymentRequest = sequelize.define('PaymentRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  requesterId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  },
  requesteeId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending'
  }
}, {
  tableName: 'payment_requests',
  timestamps: true
})

PaymentRequest.belongsTo(User, { as: 'requester', foreignKey: 'requesterId' });
PaymentRequest.belongsTo(User, { as: 'requestee', foreignKey: 'requesteeId' });
// PaymentRequest.hasOne(Message, { foreignKey: 'paymentRequestId' });

module.exports = PaymentRequest
