const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')
const User = require('./user')

// Private, per-relationship display overrides (nickname/photo/note) that only
// the owning user (userId) sees for a given friend (profileId). Never affects
// the friend's own real profile - e.g. renaming a friend in your own list.
const FriendProfile = sequelize.define('FriendProfile', {
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
  userName: {
    allowNull: true,
    type: DataTypes.STRING
  },
  profilePic: {
    allowNull: true,
    type: DataTypes.STRING
  },
  description: {
    allowNull: true,
    type: DataTypes.TEXT
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
  modelName: 'FriendProfile',
  tableName: 'friend_profiles'
})

FriendProfile.belongsTo(User, { foreignKey: 'userId' })
FriendProfile.belongsTo(User, { foreignKey: 'profileId' })

module.exports = FriendProfile
