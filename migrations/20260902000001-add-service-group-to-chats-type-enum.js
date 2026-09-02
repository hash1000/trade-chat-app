"use strict";

// Adds "service_group" to chats.type — the chat POST /api/chat/service
// creates (customer <-> service team). It was previously "chat" (1:1
// semantics: exactly 2 members, treated as a personal DM by
// findExistingDirectChat/getRelationship's hasChat check), but a service
// request chat is conceptually a group (it has an admin — the team owner —
// and can grow past 2 members as other team members are added), just one
// tagged distinctly from a user-created "group" so a client can tell the
// two apart. See ChatService.isGroupType/createServiceChat.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE chats MODIFY COLUMN type ENUM('chat','group','service_group') NOT NULL DEFAULT 'chat'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Re-type any existing service_group rows back to "chat" first — they
    // can't be represented by the narrowed enum, and "chat" is what they
    // were before this migration ever ran.
    await queryInterface.sequelize.query(`UPDATE chats SET type = 'chat' WHERE type = 'service_group'`);
    await queryInterface.sequelize.query(
      `ALTER TABLE chats MODIFY COLUMN type ENUM('chat','group') NOT NULL DEFAULT 'chat'`
    );
  },
};
