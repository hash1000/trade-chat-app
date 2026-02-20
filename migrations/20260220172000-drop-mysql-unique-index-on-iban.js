"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const sequelize = queryInterface.sequelize;
    const dialect = sequelize.getDialect();

    if (dialect !== 'mysql' && dialect !== 'mariadb') {
      console.log('This migration is intended for MySQL/MariaDB only. Skipping.');
      return;
    }

    try {
      // 1) Make column nullable and set default NULL
      try {
        await queryInterface.changeColumn('bank_accounts', 'iban', {
          type: Sequelize.STRING,
          allowNull: true,
          defaultValue: null,
        });
      } catch (err) {
        // ignore change column errors
        console.warn('changeColumn failed (ignored):', err.message || err);
      }

      // 2) Find unique indexes on the iban column
      const [rows] = await sequelize.query("SHOW INDEX FROM bank_accounts WHERE Column_name = 'iban' AND Non_unique = 0");

      if (!rows || rows.length === 0) {
        console.log('No unique indexes found for bank_accounts.iban');
        return;
      }

      // Collect unique index names (Key_name) excluding PRIMARY
      const indexNames = new Set();
      for (const row of rows) {
        const name = row.Key_name;
        if (!name || name.toUpperCase() === 'PRIMARY') continue;
        indexNames.add(name);
      }

      if (indexNames.size === 0) {
        console.log('No non-primary unique indexes to drop on bank_accounts.iban');
        return;
      }

      for (const name of indexNames) {
        try {
          console.log(`Dropping index ${name} on bank_accounts`);
          await sequelize.query(`DROP INDEX \`${name}\` ON bank_accounts`);
          console.log(`Dropped index ${name}`);
        } catch (err) {
          console.warn(`Failed to drop index ${name}:`, err.message || err);
        }
      }
    } catch (err) {
      console.error('Unexpected error while dropping unique index on iban:', err.message || err);
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    // no-op: don't recreate unique index automatically
  },
};
