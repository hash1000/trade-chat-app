"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("messages", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      chatId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "chats", key: "id" },
        onDelete: "CASCADE",
      },
      senderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      // Client-generated id sent with the socket "send message" event, used
      // to de-dup retries after a dropped ack (client resends, server
      // returns the already-created row instead of a duplicate).
      localId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      messageType: {
        type: Sequelize.ENUM(
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
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isForward: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isEdit: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isUploading: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      uploadingPercentage: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },

      // --- media ---
      mediaUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      thumbnailUrl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      thumbnailBlurHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      // --- reply ---
      replyToMessageId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "messages", key: "id" },
      },

      // --- contact card ---
      contactCardId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
      },

      // --- payment ---
      paymentRequestId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "payment_requests", key: "id" },
      },

      // --- reference attachments (snapshot-only, no side effects) ---
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "orders", key: "id" },
      },
      addressId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "address", key: "id" },
      },
      bankAccountId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "bank_accounts", key: "id" },
      },
      shortListId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "shortLists", key: "id" },
      },
      ledgerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "ledger", key: "id" },
      },

      hashtags: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("messages", ["chatId"]);
    await queryInterface.addIndex("messages", ["senderId"]);
    await queryInterface.addIndex("messages", ["replyToMessageId"]);
    await queryInterface.addIndex("messages", ["chatId", "localId"], {
      unique: true,
      name: "messages_chat_local_id_unique",
    });

    // --- per-recipient state, junction tables (chat_members pattern) ---

    await queryInterface.createTable("message_reads", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "messages", key: "id" },
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      seenAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex("message_reads", ["messageId", "userId"], {
      unique: true,
      name: "message_reads_message_user_unique",
    });

    await queryInterface.createTable("message_deletes", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "messages", key: "id" },
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      isDeleteAll: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex("message_deletes", ["messageId", "userId"], {
      unique: true,
      name: "message_deletes_message_user_unique",
    });

    // --- mentions, many-to-many per message ---

    await queryInterface.createTable("message_mentions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      messageId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "messages", key: "id" },
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex("message_mentions", ["messageId", "userId"], {
      unique: true,
      name: "message_mentions_message_user_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("message_mentions");
    await queryInterface.dropTable("message_deletes");
    await queryInterface.dropTable("message_reads");
    await queryInterface.dropTable("messages");
  },
};
