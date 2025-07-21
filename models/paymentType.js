// models/PaymentType.js
const { DataTypes } = require("sequelize");
const db = require("../config/database");

const PaymentType = db.define(
  "PaymentType",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  { tableName: "payment_types" }
);

module.exports = PaymentType;
