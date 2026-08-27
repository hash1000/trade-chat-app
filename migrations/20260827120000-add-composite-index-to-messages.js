"use strict";

// Message history's query is WHERE chatId = ? ORDER BY createdAt DESC, id DESC
// LIMIT/OFFSET. The existing "messages_chat_id" index only covers chatId, so
// MySQL still has to filesort every page. This composite index lets it walk
// straight through in the exact order needed.
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("messages", ["chatId", "createdAt", "id"], {
      name: "messages_chat_created_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("messages", "messages_chat_created_id");
  },
};
