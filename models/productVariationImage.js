const { DataTypes } = require('sequelize')
const sequelize = require('../config/database')

const ProductVariationImage = sequelize.define(
  'ProductVariationImage',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productVariationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
  },
  {
    timestamps: true,
    tableName: 'productVariationImages',
  }
)

module.exports = ProductVariationImage
