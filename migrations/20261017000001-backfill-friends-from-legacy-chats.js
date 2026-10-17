"use strict";

// Old app built the friend list from legacy `chats` rows (user1Id -> user2Id,
// with optional nickname/photo/note overrides). Convert the backup of those
// rows into `friends` + `friend_profiles`. Idempotent: skips existing pairs,
// self-pairs, and users that no longer exist.
module.exports = {
  async up(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) =>
      typeof t === "string" ? t : t.tableName
    );
    if (!tables.includes("chats_legacy_backup")) return;

    await queryInterface.sequelize.query(`
      INSERT INTO friends (userId, profileId, type, createdAt, updatedAt)
      SELECT c.user1Id, c.user2Id, 'accepted', MIN(c.createdAt), NOW()
      FROM chats_legacy_backup c
      JOIN users u1 ON u1.id = c.user1Id
      JOIN users u2 ON u2.id = c.user2Id
      WHERE c.user1Id <> c.user2Id
        AND NOT EXISTS (
          SELECT 1 FROM friends f
          WHERE f.userId = c.user1Id AND f.profileId = c.user2Id
        )
      GROUP BY c.user1Id, c.user2Id
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO friend_profiles (userId, profileId, userName, profilePic, description, createdAt, updatedAt)
      SELECT c.user1Id, c.user2Id, MAX(c.userName), MAX(c.profilePic), MAX(c.description), NOW(), NOW()
      FROM chats_legacy_backup c
      JOIN users u1 ON u1.id = c.user1Id
      JOIN users u2 ON u2.id = c.user2Id
      WHERE c.user1Id <> c.user2Id
        AND (c.userName IS NOT NULL OR c.profilePic IS NOT NULL OR c.description IS NOT NULL)
        AND NOT EXISTS (
          SELECT 1 FROM friend_profiles p
          WHERE p.userId = c.user1Id AND p.profileId = c.user2Id
        )
      GROUP BY c.user1Id, c.user2Id
    `);
  },

  async down() {
    // Intentionally a no-op; data backfill.
  },
};
