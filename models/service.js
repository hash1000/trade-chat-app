// models/service.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Service = sequelize.define(
  "Service",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Owner of service",
    },

    payoutWalletId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Wallet that receives payments",
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    profile_image: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },
  },
  {
    tableName: "services",
    timestamps: true,

    indexes: [
      { fields: ["userId"] },
      { fields: ["payoutWalletId"] },
    ],
  }
);

module.exports = Service;