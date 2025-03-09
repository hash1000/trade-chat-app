const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Chat = sequelize.define(
    "Chat",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user1Id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      user2Id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
      },
      userName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profilePic: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      tags: {
        type: DataTypes.JSON, // Adjusted for MySQL
        defaultValue: [],
      },
      lastReadUser1Id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      lastReadUser2Id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "chats",
    }
  );

  Chat.associate = function (models) {
    Chat.belongsTo(models.User, { as: "user1", foreignKey: "user1Id", constraints: false });
    Chat.belongsTo(models.User, { as: "user2", foreignKey: "user2Id", constraints: false });
    Chat.hasMany(models.Message, { as: "messages", foreignKey: "chatId", constraints: false });
  };

  return Chat;
};
