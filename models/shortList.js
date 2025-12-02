// ShortList.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Category = require("./category");

const ShortList = sequelize.define(
  "shortList",
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
    adminNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    customerNote: {
      type: DataTypes.TEXT,
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
    tableName: "shortList",
  }
);

module.exports = ShortList;
