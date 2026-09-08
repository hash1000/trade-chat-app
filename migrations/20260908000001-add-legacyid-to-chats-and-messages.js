"use strict";

// Supports the Firestore -> MySQL chat/message migration (scripts/migrateFirebaseChats.js).
// Nullable + unique: only rows created by that script ever get a value, and
// the unique index is what makes a re-run after a crash/interruption cheap
// and safe — the script checks "does a chat/message with this legacyId
// already exist" instead of re-deriving state from scratch.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("chats", "legacyId", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex("chats", ["legacyId"], {
      unique: true,
      name: "chats_legacy_id_unique",
    });

    await queryInterface.addColumn("messages", "legacyId", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex("messages", ["legacyId"], {
      unique: true,
      name: "messages_legacy_id_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex("messages", "messages_legacy_id_unique");
    await queryInterface.removeColumn("messages", "legacyId");

    await queryInterface.removeIndex("chats", "chats_legacy_id_unique");
    await queryInterface.removeColumn("chats", "legacyId");
  },
};
