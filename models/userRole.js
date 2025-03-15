const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserRole = sequelize.define(
  "User_Roles",
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
    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "User_Roles",
    timestamps: true, // Enables createdAt & updatedAt automatically
  }
);

module.exports = UserRole;
