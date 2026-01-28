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
      type: DataTypes.TEXT,
    },
    ledgerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paymentTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  { tableName: "incomes", timestamps: true },
);

module.exports = Income;
