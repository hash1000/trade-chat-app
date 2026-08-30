"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Presence moved to users.isOnline/lastSeenAt (see the prior
    // migration) — it's a global fact about a user, not one fact per chat
    // they're in. Nothing reads these columns anymore.
    await queryInterface.removeColumn("chat_members", "memberStatus");
    await queryInterface.removeColumn("chat_members", "statusUpdatedAt");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("chat_members", "memberStatus", {
      type: Sequelize.ENUM("online", "offline"),
      allowNull: false,
      defaultValue: "offline",
    });
    await queryInterface.addColumn("chat_members", "statusUpdatedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },
};
