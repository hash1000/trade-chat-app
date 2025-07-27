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
      validate: {
        len: [0, 100] // Limit title length to 100 characters
      }
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    balanceSheetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'balance_sheet',
        key: 'id'
      }
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
    tableName: "ledger",
    timestamps: true,
    indexes: [
      {
        fields: ['balanceSheetId']
      }
    ]
  }
);

module.exports = Ledger;