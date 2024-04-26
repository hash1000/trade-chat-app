const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'user'
  },
  country_code: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  profilePic: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  settings: {
    type: DataTypes.JSON
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  resetToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fcm: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tokenVersion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  likes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  dislikes: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_online: {
    type: DataTypes.BOOLEAN,
    defaultValue: 0
  },
  last_login: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  personalWalletBalance: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  companyWalletBalance: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  otp: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'users' // Specify the table name
})

User.prototype.toJSON = function () {
  const values = { ...this.get() }
  delete values.password
  delete values.resetToken
  delete values.tokenVersion
  delete values.otp
  return values
}

module.exports = User
