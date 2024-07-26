const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

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
        model: User,
        key: "id",
      },
    },
    profileId: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE,
    },
  },
  {
    modelName: "UserFavourite",
    tableName: "user_favourites",
  }
);

// Define the association with User
UserFavourite.belongsTo(User, { foreignKey: "userId" });
UserFavourite.belongsTo(User, { foreignKey: "profileId" });

module.exports = UserFavourite;
