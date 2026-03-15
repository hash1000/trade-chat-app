const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const TeamServiceLink = sequelize.define(
  "TeamService",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "team_services",
    timestamps: true,
  }
);

module.exports = TeamServiceLink;
