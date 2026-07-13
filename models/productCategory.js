const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Join table: one product → many public categories
const ProductCategory = sequelize.define(
  "ProductCategory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    publicCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "product_categories",
    timestamps: true,
  }
);

module.exports = ProductCategory;
