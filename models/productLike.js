const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductLike = sequelize.define(
  "ProductLike",
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
    tableName: "product_likes",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "shopProductId"],
      },
    ],
  }
);

module.exports = ProductLike;
