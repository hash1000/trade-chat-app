"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("chats", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      groupName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      groupImage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      groupOnlineImage: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM("chat", "group"),
        allowNull: false,
        defaultValue: "chat",
      },
      adminId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
      lastMessage: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      lastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      allowMembersToViewProfile: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      enableAIAnswer: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lockSettings: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      simpleModeOn: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Set when this chat was created from an order that bundled one or
      // more isChat services — lookup key for "does this order already
      // have a chat", regardless of how many services are attached.
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "orders",
          key: "id",
        },
      },
      customerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
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

    await queryInterface.addIndex("chats", ["orderId"]);
    await queryInterface.addIndex("chats", ["customerId"]);
    await queryInterface.addIndex("chats", ["adminId"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("chats");
  },
};
