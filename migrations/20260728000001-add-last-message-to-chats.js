"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("chats", "lastMessageText", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "lastReadUser2Id",
    });
    await queryInterface.addColumn("chats", "lastMessageAt", {
      type: Sequelize.DATE,
      allowNull: true,
      after: "lastMessageText",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("chats", "lastMessageAt");
    await queryInterface.removeColumn("chats", "lastMessageText");
  },
};
