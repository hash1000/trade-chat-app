// models/Transaction.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Transaction = sequelize.define("Transaction", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  fromUserId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Only used for transfers
  },
  toUserId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Only used for transfers
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  usdAmount: {
    type: DataTypes.FLOAT,
    allowNull: true, // Make nullable for P2P
  },
  rate: {
    type: DataTypes.FLOAT,
    allowNull: true, // Make nullable for P2P
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "CNY",
  },
  type: {
    type: DataTypes.ENUM(
      "wallet_topup",
      "wallet_transfer",
      "wallet_receive",
      "wallet_refund",
      "wallet_bonus",
      "wallet_deduct",
      "admin_adjustment"
    ),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("pending", "completed", "failed"),
    defaultValue: "completed",
  },
  source: {
    type: DataTypes.STRING, // 'stripe', 'paypal', 'peer', 'admin'
    allowNull: true,
  },
  paymentMethod: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: "transactions",
  timestamps: true,
});

module.exports = Transaction;
