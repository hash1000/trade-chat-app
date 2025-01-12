const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OTP = sequelize.define(
  "OTP",
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
    tableName: "OTP",
    timestamps: false,
  }
);

module.exports = OTP;

