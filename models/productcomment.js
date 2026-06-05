const { DataTypes, Model } = require('sequelize')
const sequelize = require('../config/database')

class ProductComment extends Model {}

ProductComment.init(
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
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 2000]
      }
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_edited'
    }
  },
  {
    sequelize,
    modelName: 'ProductComment',
    tableName: 'product_comments',
    underscored: true,
    timestamps: true,
    paranoid: true, // soft-delete so audit trail is preserved
    indexes: [
      { fields: ['shop_product_id'] },
      { fields: ['user_id'] }
    ]
  }
)

// Self-referential for threading
ProductComment.hasMany(ProductComment, {
  as: 'replies',
  foreignKey: 'parentId'
})
ProductComment.belongsTo(ProductComment, {
  as: 'parent',
  foreignKey: 'parentId'
})

module.exports = ProductComment