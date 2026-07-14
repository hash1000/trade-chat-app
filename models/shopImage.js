const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShopImage = sequelize.define(
  'ShopImage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: 'shopImages',
  }
);

module.exports = ShopImage;
