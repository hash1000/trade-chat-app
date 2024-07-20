const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user')

const Friends = sequelize.define('Friends', {
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
  profileId: {
    allowNull: false,
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    }
  },
  type: {
    allowNull: false,
    type: DataTypes.ENUM('sent', 'accepted', 'rejected', 'blocked', 'removed')
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
    modelName: 'Friends',
    tableName: 'friends'
  })

// Define the association with User
Friends.belongsTo(User, { foreignKey: 'userId' })
Friends.belongsTo(User, { foreignKey: 'profileId' })

module.exports = Friends
