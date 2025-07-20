// models/Transaction.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Transaction = sequelize.define("Transaction", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  orderId: {
    type: DataTypes.STRING, // Changed from INTEGER to STRING
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("pending", "success", "failed"),
    defaultValue: "pending",
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transactionRef: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Add any other fields you're trying to insert
  usdAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  rate: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  }
}, {
  tableName: "transaction", // Match your migration
  timestamps: true
});

module.exports = Transaction;