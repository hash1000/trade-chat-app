// models/OTP.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const EmailOtp = sequelize.define(
  "EmailOtp",
  {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiration_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "EmailOtp",
    timestamps: false,
  }
);

module.exports = EmailOtp;
