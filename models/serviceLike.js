const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceLike = sequelize.define(
  "ServiceLike",
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
    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "service_likes",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "serviceId"],
      },
    ],
  }
);

module.exports = ServiceLike;
