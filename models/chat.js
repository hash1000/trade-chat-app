const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Chat = sequelize.define(
  "Chat",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    groupName: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    groupImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    groupOnlineImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // "chat": 1:1 (createDirectChat) · "group": user-created multi-member
    // group (createGroup) · "service_group": customer <-> service team
    // (createServiceChat) — a group in every behavioral sense (has an
    // admin, can grow past 2 members) but tagged distinctly so a client
    // can render/filter it apart from a plain user-made group. See
    // ChatService.isGroupType.
    type: {
      type: DataTypes.ENUM("chat", "group", "service_group"),
      allowNull: false,
      defaultValue: "chat",
    },

    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    lastMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    allowMembersToViewProfile: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    enableAIAnswer: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    lockSettings: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    simpleModeOn: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // When true, any current member can add others (POST /:id/members) —
    // not just the group admin. See ChatService.assertCanAddMembers.
    allowMembersToAddOthers: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Set when this chat was created from an order that bundled one or
    // more isChat services — lookup key for "does this order already have
    // a chat", regardless of how many services ended up attached. The
    // actual service links live in ChatService (chat_services).
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "chats",
    timestamps: true,
  }
);

module.exports = Chat;
