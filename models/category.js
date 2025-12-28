// Category.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const Category = sequelize.define(
  "categories",
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
    pin: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
  },
  {
    timestamps: true,
    tableName: "categories",
    indexes: [
      {
        unique: true,
        fields: ["userId", "title"], // <<< UNIQUE per-user title
        name: "unique_user_category_title",
      },
    ],
  }
);

module.exports = Category;
