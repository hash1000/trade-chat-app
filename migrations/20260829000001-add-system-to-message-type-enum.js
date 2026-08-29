"use strict";

// Adds "system" to messages.messageType — server-generated announcements
// (member joined/left/removed) created by ChatService.postSystemMessage,
// never something a client can send directly (MessageService.sendMessage
// rejects it outright).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE messages MODIFY COLUMN messageType ENUM('text','image','video','audio','file','contact','payment','order','address','bankCard','shortList','balanceSheet','system') NOT NULL DEFAULT 'text'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Drop any system messages first — they can't be represented by the
    // narrowed enum, and re-typing them as "text" would misrepresent them.
    await queryInterface.sequelize.query(`DELETE FROM messages WHERE messageType = 'system'`);
    await queryInterface.sequelize.query(
      `ALTER TABLE messages MODIFY COLUMN messageType ENUM('text','image','video','audio','file','contact','payment','order','address','bankCard','shortList','balanceSheet') NOT NULL DEFAULT 'text'`
    );
  },
};
