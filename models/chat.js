  const sequelize = require("../config/database");
  const { DataTypes } = require("sequelize");
  const User = require("./user");
  const Message = require("./message");

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
    },
    {
      tableName: "chats",
      timestamps: true,
    }
  );
  
  //
  Chat.belongsTo(User, { as: "user1", foreignKey: "user1Id" });
  Chat.belongsTo(User, { as: "user2", foreignKey: "user2Id" });
  Chat.hasMany(Message, { as: "message", foreignKey: "chatId" });

  module.exports = Chat;
