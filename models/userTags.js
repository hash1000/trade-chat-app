const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
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
      tableName: "user_tags",
    }
  );

  UserTags.associate = function (models) {
    UserTags.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    models.User.hasOne(UserTags, { foreignKey: "userId", as: "userTags" });
  };

  return UserTags;
};
