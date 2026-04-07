const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Team = sequelize.define(
  "Team",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // type: {
    //   type: DataTypes.STRING,
    //   allowNull: true,
    // },
    profile_image: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "teams",
    timestamps: true,
  }
);

module.exports = Team;
