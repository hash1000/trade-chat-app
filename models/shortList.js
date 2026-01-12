// models/shortList.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const ShortList = sequelize.define(
  "shortLists", // plural table name
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM("CHECKMARK", "NUMBERS", "BULLETS", "STEPS", "TASK"),
      allowNull: false,
      defaultValue: "NUMBERS",
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
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "categories",
        key: "id", // Column that the foreign key points to
      },
    },
    userId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    pin: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "shortLists",
  }
);

module.exports = ShortList;
