const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Join table: one shop → many teams
const ShopTeamLink = sequelize.define(
  "ShopTeam",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    teamId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "shop_teams",
    timestamps: true,
  }
);

module.exports = ShopTeamLink;
