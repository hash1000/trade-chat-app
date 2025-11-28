// Category.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const PaymentType = require("./paymentType");
const User = require("./user");

const Category = sequelize.define(
  "category",
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
        len: [1, 100],
      },
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
    paymentTypeId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: PaymentType,
        key: "id",
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    timestamps: true,
    tableName: "category",
  }
);

module.exports = Category;
