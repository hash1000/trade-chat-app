"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Per-member, per-chat mute — when true, this member is skipped from
    // the push-notification fan-out for new messages/system messages in
    // this chat (MessageService.notifyNewMessage). Unread counts and the
    // messages themselves are unaffected — only the notification/push.
    await queryInterface.addColumn("chat_members", "isMuted", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("chat_members", "isMuted");
  },
};
