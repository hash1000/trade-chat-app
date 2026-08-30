const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ChatMember = sequelize.define(
  "ChatMember",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    chatId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    isAdmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    unreadCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    isMention: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isFavourite: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isArchived: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isDeleteAll: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isBlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Personal, per-chat — when true, this member is skipped from the
    // push-notification fan-out for this chat (MessageService.
    // notifyNewMessage). Doesn't affect unread counts or message visibility.
    isMuted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "chat_members",
    timestamps: true,
    indexes: [
      { fields: ["chatId"] },
      { fields: ["userId"] },
      { unique: true, fields: ["chatId", "userId"] },
    ],
  }
);

module.exports = ChatMember;
