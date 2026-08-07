const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Join table: one row per service bundled into a chat. A plain
// service-linked chat has exactly one row; an order-combined chat
// (Chat.orderId set) has one row per isChat service in that order.
const ChatService = sequelize.define(
  "ChatService",
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

    serviceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    teamId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // Status of this specific request against this specific service,
    // not the service listing's own status.
    status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    requestSubject: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    requestDesc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "chat_services",
    timestamps: true,
    indexes: [
      { fields: ["chatId"] },
      { fields: ["serviceId"] },
      { unique: true, fields: ["chatId", "serviceId"] },
    ],
  }
);

module.exports = ChatService;
