const { DataTypes, Model } = require("sequelize");
const sequelize = require("../config/database");

const ShopProduct = sequelize.define(
  "ShopProduct",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    discount: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      field: "discount",
      validate: {
        min: 0,
        max: 100,
      },
    },

    discountStartDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "discount_start_date",
    },

    discountEndDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "discount_end_date",
    },

    isDiscountActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_discount_active",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    likeCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "like_count",
    },
    dislikeCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "dislike_count",
    },
    reviewCount: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "review_count",
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
      field: "average_rating",
    },
  },
  {
    sequelize,
    modelName: "shopProduct",
    tableName: "shopProducts",
    underscored: true,
    timestamps: true,
    paranoid: true, // soft deletes via deleted_at
    indexes: [
      { fields: ["user_id"] },
      { fields: ["category"] },
      { fields: ["average_rating"] },
    ],
  },
);

module.exports = ShopProduct;
