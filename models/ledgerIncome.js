// models/Income.js
const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Income = db.define(
  "Income",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
    },
    ledgerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // other fields as needed
  },
  { tableName: "incomes" }
);

module.exports = Income;
