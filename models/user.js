const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "user",
    },
    country_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    age: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profilePic: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    settings: {
      type: DataTypes.JSONB, // Change to JSONB if your database supports it for better performance
      defaultValue: {
        paymentCode: "", // Default empty string for paymentCode
        password: "12345678",
        tags: [],
        emails: ["example@example.com"],
        phoneNumbers: ["1234567890"],
        description: "Default description",
      },
    },
    friendShip: {
      type: DataTypes.JSON,
      defaultValue: {
        type: "defaultType",
        userId: 0,
        profileId: 0,
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fcm: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    likes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    dislikes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    is_online: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    last_login: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },
    personalWalletBalance: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    companyWalletBalance: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    expiration_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users", // Specify the table name
  }
);

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.resetToken;
  delete values.tokenVersion;
  delete values.otp;
  return values;
};

module.exports = User;
