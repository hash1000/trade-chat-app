"use strict";

// Drops legacy chats/messages tables, keeping a backup copy first.
// Uses CREATE TABLE ... LIKE so the primary key is kept (required on DO MySQL).
// If the backup fails, the migration fails and nothing is dropped.
module.exports = {
  up: async (queryInterface) => {
    const tables = (await queryInterface.showAllTables()).map((t) =>
      typeof t === "string" ? t : t.tableName
    );

    for (const name of ["chats", "messages"]) {
      if (!tables.includes(name)) continue;
      const backup = `${name}_legacy_backup`;
      if (!tables.includes(backup)) {
        await queryInterface.sequelize.query(`CREATE TABLE \`${backup}\` LIKE \`${name}\``);
        await queryInterface.sequelize.query(`INSERT INTO \`${backup}\` SELECT * FROM \`${name}\``);
      }
    }

    await queryInterface.dropTable("messages").catch(() => {});
    await queryInterface.dropTable("chats").catch(() => {});
  },

  down: async () => {},
};
