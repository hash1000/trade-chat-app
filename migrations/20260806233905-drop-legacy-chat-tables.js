"use strict";

// Drops the `chats`/`messages` tables left over from the chat feature
// removed in commit 7c64f0c ("remove chat and update apis"). Both were
// empty and no application code has referenced them since; the new chat
// feature replaces them with a normalized chats/chat_members/chat_services
// schema created by the migrations that follow this one.

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.dropTable("messages").catch(() => {});
    await queryInterface.dropTable("chats").catch(() => {});
  },

  down: async () => {
    // Irreversible on purpose — the legacy schema is gone for good.
  },
};
