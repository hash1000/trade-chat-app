const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Message = sequelize.define(
  "Message",
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

    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // Client-generated id sent with the socket "send message" event, used
    // to de-dup retries after a dropped ack.
    localId: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    messageType: {
      type: DataTypes.ENUM(
        "text",
        "image",
        "video",
        "audio",
        "file",
        "contact",
        "payment",
        "order",
        "address",
        "bankCard",
        "shortList",
        "balanceSheet"
      ),
      allowNull: false,
      defaultValue: "text",
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isForward: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isEdit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isUploading: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    uploadingPercentage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    // --- media ---
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    thumbnailUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    thumbnailBlurHash: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // --- reply ---
    replyToMessageId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // --- contact card ---
    contactCardId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // --- payment ---
    paymentRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // --- reference attachments: snapshot-only, no side effects ---
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    addressId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    bankAccountId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    shortListId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // "balanceSheet" in the client payload — maps to the existing Ledger model.
    ledgerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    hashtags: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "messages",
    timestamps: true,
  }
);

module.exports = Message;
