// models/List.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ShortList = require("./shortList");

const List = sequelize.define(
  "lists",
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
        len: [1, 200],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shortListId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: ShortList,
        key: "id",
      },
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    }
  },
  {
    timestamps: true,
    tableName: "lists",
  }
);

module.exports = List;



