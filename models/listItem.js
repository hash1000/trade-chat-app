// ListItem.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Category = require("./category");

const ListItem = sequelize.define(
  "listItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 100],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    categoryId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: Category,
        key: "id",
      },
    }
  },
  {
    timestamps: true,
    tableName: "listItem",
  }
);

module.exports = ListItem;
