const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const Shop = sequelize.define(
  'Shop',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    header_image: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    header_image_thumbnail: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    profile_image: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    profile_image_thumbnail: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    name: {
      type: DataTypes.STRING, 
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    editorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    // which wallet of the shop owner gets paid
    payoutWalletId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // e.g. "15-30 days" — how long the shop takes to fulfil by-order items
    leadTime: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    rating: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: 'shops',
  }
)

module.exports = Shop
