const { DataTypes, Model } = require('sequelize')
const sequelize = require('../config/database')

class ProductRating extends Model {}

ProductRating.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'shop_product_id'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    value: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    }
  },
  {
    sequelize,
    modelName: 'ProductRating',
    tableName: 'product_ratings',
    underscored: true,
    timestamps: true,
    indexes: [
      // One rating per user per product
      {
        unique: true,
        fields: ['shop_product_id', 'user_id'],
        name: 'uq_product_rating_user'
      },
      { fields: ['shop_product_id'] }
    ]
  }
)

module.exports = ProductRating