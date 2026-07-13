const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductRating = sequelize.define(
  "ProductRating",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopProductId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0, max: 10 },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "product_ratings",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["shopProductId", "userId"],
      },
    ],
  }
);

module.exports = ProductRating;
