const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceCategoryLink = sequelize.define(
  "ServiceCategory",
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
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "service_categories",
    timestamps: true,
  }
);

module.exports = ServiceCategoryLink;
