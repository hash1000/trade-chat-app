const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductView = sequelize.define(
  "ProductView",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "product_views",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "shopProductId"],
      },
    ],
  }
);

module.exports = ProductView;
