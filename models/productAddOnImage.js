const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductAddOnImage = sequelize.define(
  "ProductAddOnImage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productAddOnId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    timestamps: true,
    tableName: "productAddOnImages",
  }
);

module.exports = ProductAddOnImage;
