const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')
const PaymentRequest = require('./payment_request')
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  local_id: {
    type: DataTypes.INTEGER,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Chat',
      key: 'id'
    }
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'User',
      key: 'id'
    }
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  quoteToId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  paymentRequestId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'PaymentRequest',
      key: 'id'
    }
  },
  settings: {
    type: DataTypes.JSON,
    allowNull: true
  },
},
  {
    tableName: 'messages',
    timestamps: true
  })

// Message.belongsTo(Chat, { foreignKey: 'chatId' });
// Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
Message.belongsTo(PaymentRequest, { foreignKey: 'paymentRequestId' })
Message.belongsTo(Message, { as: 'replyTo', foreignKey: 'quoteToId' })

module.exports = Message
