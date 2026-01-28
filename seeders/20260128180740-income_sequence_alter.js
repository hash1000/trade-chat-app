"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [ledgers] = await queryInterface.sequelize.query(`
      SELECT DISTINCT ledgerId FROM incomes
    `);

    console.log(
      `Found ${ledgers.length} ledgers with incomes. Updating income sequence...`
    );

    for (const row of ledgers) {
      const ledgerId = row.ledgerId;

      const [incomes] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM incomes
        WHERE ledgerId = :ledgerId
        ORDER BY createdAt ASC
        `,
        { replacements: { ledgerId } }
      );

      console.log(
        `Ledger ${ledgerId}: ${incomes.length} incomes found`
      );

      for (let i = 0; i < incomes.length; i++) {
        const sequenceValue = i + 1;
console.log(
          `Setting sequence ${sequenceValue} for incomeId ${incomes[i].id}`
        );
        await queryInterface.sequelize.query(
          `
          UPDATE incomes
          SET sequence = :sequence
          WHERE id = :id
          `,
          {
            replacements: {
              sequence: sequenceValue,
              id: incomes[i].id,
            },
          }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE incomes
      SET sequence = 0
    `);
  },
};
