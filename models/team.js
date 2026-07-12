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
    profile_image: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    // 'shop' teams are private to their creator (no admin override);
    // 'service' teams allow admin involvement
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "service",
    },
  },
  {
    tableName: "teams",
    timestamps: true,
  }
);

module.exports = Team;
