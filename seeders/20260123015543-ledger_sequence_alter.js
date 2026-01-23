"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [ledgers] = await queryInterface.sequelize.query(`
      SELECT DISTINCT userId FROM ledger
    `);
    console.log(
      `Found ${ledgers.length} ledgers. Updating sequence...`,
      ledgers,
    );

    for (const ledger of ledgers) {
      const [userLedgers] = await queryInterface.sequelize.query(
        `SELECT id FROM ledger WHERE userId = :userId ORDER BY createdAt ASC`,
        { replacements: { userId: ledger.userId } },
      );

      console.log(
        `Updating sequence for userId ${ledger.userId} with ${userLedgers.length} ledgers.`,
      );

      for (let i = 0; i < userLedgers.length; i++) {
        const ledgerId = userLedgers[i].id;
        const sequenceValue = i + 1; // Start sequence from 1

        console.log(
          `Setting sequence ${sequenceValue} for ledgerId ${ledgerId}`,
        );

        await queryInterface.sequelize.query(
          `UPDATE ledger SET sequence = :sequence WHERE id = :ledgerId`,
          { replacements: { sequence: sequenceValue, ledgerId } },
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
    UPDATE ledger
    SET sequence = NULL
  `);
  },
};
