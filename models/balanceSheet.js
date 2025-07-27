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
    userId: {
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
  { 
    tableName: "balance_sheet",
    indexes: [
      {
        fields: ['userId'] // Index for faster user queries
      }
    ]
  }
);

module.exports = BalanceSheet;