const { DataTypes, Model } = require('sequelize')
const sequelize = require('../config/database')

const ProductImage = sequelize.define(
  "product_images",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: { notEmpty: true }
    },
    sortOrder: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
      comment: '0 = primary/cover image'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_primary'
    }
  },
  {
    sequelize,
    modelName: 'ProductImage',
    tableName: 'product_images',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['shop_product_id'] },
      { fields: ['shop_product_id', 'is_primary'] }
    ]
  }
)

module.exports = ProductImage