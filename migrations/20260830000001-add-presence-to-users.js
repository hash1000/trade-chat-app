"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Global presence, one fact per user — not per chat. Replaces
    // chat_members.memberStatus/statusUpdatedAt, which required scanning
    // every chat a user belongs to (and every other member in each of
    // them) just to know/tell "are they online" — expensive for an
    // account in thousands of chats, and conceptually wrong: being online
    // isn't a property of any one chat.
    await queryInterface.addColumn("users", "isOnline", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("users", "lastSeenAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "lastSeenAt");
    await queryInterface.removeColumn("users", "isOnline");
  },
};
