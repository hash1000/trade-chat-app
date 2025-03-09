const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Friends = sequelize.define(
    "Friends",
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
      type: {
        allowNull: false,
        type: DataTypes.ENUM("sent", "accepted", "rejected", "blocked", "removed"),
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
      tableName: "friends",
    }
  );

  Friends.associate = function (models) {
    Friends.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Friends.belongsTo(models.User, { foreignKey: "profileId", as: "profile" });
  };

  return Friends;
};
