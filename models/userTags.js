const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user"); // Import after defining User

const UserTags = sequelize.define(
  "UserTags",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [], // Default to an empty array
    },
    userId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: "users", // Reference table name
        key: "id",
      },
      unique: true, // Ensure one-to-one relationship
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "userTags",
  }
);

UserTags.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasOne(UserTags, { foreignKey: "userId", as: "userTags" });

module.exports = UserTags;
