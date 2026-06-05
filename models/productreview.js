const { DataTypes, Model } = require('sequelize')
const sequelize = require('../config/database')

const ProductReview = sequelize.define(
  "product_reviews",
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
    rating: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      validate: { min: 1, max: 5 },
      comment: 'Embedded rating — drives product.average_rating'
    }
  },
  {
    sequelize,
    modelName: 'ProductReview',
    tableName: 'product_reviews',
    underscored: true,
    timestamps: true,
    paranoid: true,
    indexes: [
      // One review per user per product
      {
        unique: true,
        fields: ['shop_product_id', 'user_id'],
        name: 'uq_product_review_user'
      },
      { fields: ['product_id', 'status'] },
      { fields: ['rating'] }
    ]
  }
)

module.exports = ProductReview