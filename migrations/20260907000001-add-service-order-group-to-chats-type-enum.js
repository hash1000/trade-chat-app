"use strict";

// Adds "service_order_group" to chats.type — the chat POST /api/chat/order
// (createOrGetOrderChat) creates. It was previously plain "chat" (1:1
// semantics) even though it already bundled every isChat service in an
// order into one chat_services-linked thread; now it's tagged distinctly,
// same reasoning as the earlier "service_group" migration: it has an admin
// (the customer) and can hold many members (every team linked to every
// bundled service), just distinguishable from a plain user-made "group" or
// a single-service "service_group". See ChatService.isGroupType/
// createOrGetOrderChat.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE chats MODIFY COLUMN type ENUM('chat','group','service_group','service_order_group') NOT NULL DEFAULT 'chat'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Re-type any existing service_order_group rows back to "chat" first —
    // they can't be represented by the narrowed enum, and "chat" is what
    // they were before this migration ever ran.
    await queryInterface.sequelize.query(
      `UPDATE chats SET type = 'chat' WHERE type = 'service_order_group'`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE chats MODIFY COLUMN type ENUM('chat','group','service_group') NOT NULL DEFAULT 'chat'`
    );
  },
};
