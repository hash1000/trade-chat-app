const { DataTypes, Model } = require('sequelize')
const sequelize = require('../config/database')

const ProductReaction = sequelize.define(
  "product_reactions",
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
    type: {
      type: DataTypes.ENUM('like', 'dislike'),
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'ProductReaction',
    tableName: 'product_reactions',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['shop_product_id', 'user_id'],
        name: 'uq_product_reaction_user'
      },
      { fields: ['shop_product_id', 'type'] }
    ]
  }
)

module.exports = ProductReaction