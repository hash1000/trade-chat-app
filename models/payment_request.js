const sequelize = require("../config/database");
const { DataTypes } = require("sequelize");
const User = require("./user");

const PaymentRequest = sequelize.define(
  "PaymentRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    requesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "User",
        key: "id",
      },
    },
    requesteeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "User",
        key: "id",
      },
    },
    // Null when created as a bare request ("send request without payment") —
    // the requestee supplies the amount when they accept.
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "CNY",
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    // "direct" = created via sendPayment, transfer already happened.
    // "request" = created via sendPaymentRequest, awaiting accept/reject.
    kind: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "request",
    },
    // Which wallet the transfer was (direct) or should be (request, once
    // accepted) made against. Mirrors Wallet.walletType.
    walletType: {
      type: DataTypes.ENUM("PERSONAL", "COMPANY"),
      allowNull: false,
      defaultValue: "PERSONAL",
    },
  },
  {
    tableName: "payment_requests",
    timestamps: true,
  },
);


module.exports = PaymentRequest;
