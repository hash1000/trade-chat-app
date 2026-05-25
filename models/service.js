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

    pricing_type: {
      type: DataTypes.ENUM("free", "fixed", "range"),
      allowNull: false,
      defaultValue: "fixed",
    },

    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
    },

    min_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    max_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    }
    
  },
  {
    tableName: "services",
    timestamps: true,
  }
);

module.exports = Service;