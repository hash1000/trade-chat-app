const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user')

const Reaction = sequelize.define('Reaction', {
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
    type: DataTypes.ENUM('like', 'dislike')
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
    modelName: 'Reaction',
    tableName: 'reactions'
  })

// Define the association with User
Reaction.belongsTo(User, { foreignKey: 'userId' })
Reaction.belongsTo(User, { foreignKey: 'profileId' })

module.exports = Reaction
