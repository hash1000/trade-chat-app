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
    // (createServiceChat) · "service_order_group": customer <-> every team
    // linked to every chat-enabled (isChat) service in one order, bundled
    // into a single thread (createOrGetOrderChat) — every one of these is a
    // group in every behavioral sense (has an admin, can grow past 2
    // members) but tagged distinctly so a client can render/filter it apart
    // from a plain user-made group. See ChatService.isGroupType.
    type: {
      type: DataTypes.ENUM("chat", "group", "service_group", "service_order_group"),
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

    // Set when this chat was created from a *service* order (Order +
    // ServiceOrder) that bundled one or more isChat services — lookup key
    // for "does this service order already have a chat", regardless of how
    // many services ended up attached. The actual service links live in
    // ChatService (chat_services). Named "serviceOrderId", not bare
    // "orderId": product/shop orders (ProductOrder/ProductShopOrder) live
    // in entirely separate tables with their own id spaces, not `orders`,
    // so this column can only ever mean "orders.id" — a future product- or
    // shop-order chat would need (and get) its own, differently-named
    // column, not this one.
    serviceOrderId: {
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
