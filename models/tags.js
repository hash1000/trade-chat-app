const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Tags = sequelize.define("Tags", {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    autoIncrement: true,  // This will auto-generate IDs
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ensure tag names are unique
  },
}, {
  timestamps: true, // Add timestamps if needed
});

module.exports = Tags;
