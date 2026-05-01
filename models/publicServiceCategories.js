const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServicePublicCategory = sequelize.define(
  "service_public_categories",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    publicCategoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "service_public_categories",
    timestamps: true,
  }
);

module.exports = ServicePublicCategory;
