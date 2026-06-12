const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceRating = sequelize.define(
  "ServiceRating",
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "service_ratings",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["serviceId", "userId"],
      },
    ],
  }
);

module.exports = ServiceRating;
