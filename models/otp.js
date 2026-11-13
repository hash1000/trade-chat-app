const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OTP = sequelize.define(
  "otp",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    otp: {
      type: DataTypes.JSON, 
      allowNull: true,
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
    contact: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // HMAC of the current code (utilities/otpCodes.js); the plain code is never stored.
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    send_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    send_window_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contact_type: {
      type: DataTypes.ENUM("email", "phoneNumber"),
      allowNull: false,
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
    tableName: "otp",
    timestamps: false,
  }
);

module.exports = OTP;

