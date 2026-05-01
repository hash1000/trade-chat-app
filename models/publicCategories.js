// Category.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PublicCategory = sequelize.define(
  "public_categories",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  },
  {
    timestamps: true,
    tableName: "public_categories"
  }
);

module.exports = PublicCategory;