const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Role = db.define(
  "Role",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Ensures roles like 'admin', 'operator' are unique
    },
  },
  {
    timestamps: true, // Enables createdAt & updatedAt automatically
  }
);

module.exports = Role;
