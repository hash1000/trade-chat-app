const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ServiceView = sequelize.define(
  "ServiceView",
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
    tableName: "service_views",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "serviceId"],
      },
    ],
  }
);

module.exports = ServiceView;
