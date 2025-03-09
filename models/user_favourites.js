const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const UserFavourite = sequelize.define(
    "UserFavourite",
    {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      userId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: "users",
          key: "id",
        },
      },
      profileId: {
        allowNull: false,
        type: DataTypes.INTEGER,
        references: {
          model: "users",
          key: "id",
        },
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
      tableName: "user_favourites",
    }
  );

  UserFavourite.associate = function (models) {
    UserFavourite.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    UserFavourite.belongsTo(models.User, { foreignKey: "profileId", as: "profile" });
  };

  return UserFavourite;
};
