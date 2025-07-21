const { DataTypes } = require("sequelize");
const db = require("../config/database");

const BalanceSheet = db.define(
  "BalanceSheet",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    totalIncome: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    totalExpence: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  { tableName: "balance_sheet" }
);

module.exports = BalanceSheet;
