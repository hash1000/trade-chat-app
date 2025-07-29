// models/Expense.js
const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Expense = db.define(
  "Expense",
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
    paymentTypeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { tableName: "expenses", timestamps: true }
);


module.exports = Expense;
