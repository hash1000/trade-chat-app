// models/Ledger.js
const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Ledger = db.define(
  "Ledger",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    balanceSheetId: {
      // Fixed typo from banceSheetId
      type: DataTypes.INTEGER,
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
  { tableName: "ledger" }
);

module.exports = Ledger;
