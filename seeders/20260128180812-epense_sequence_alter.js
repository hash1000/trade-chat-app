"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [ledgers] = await queryInterface.sequelize.query(`
      SELECT DISTINCT ledgerId FROM expenses
    `);

    console.log(
      `Found ${ledgers.length} ledgers with expenses. Updating expense sequence...`
    );

    for (const row of ledgers) {
      const ledgerId = row.ledgerId;

      const [expenses] = await queryInterface.sequelize.query(
        `
        SELECT id
        FROM expenses
        WHERE ledgerId = :ledgerId
        ORDER BY createdAt ASC
        `,
        { replacements: { ledgerId } }
      );

      console.log(
        `Ledger ${ledgerId}: ${expenses.length} expenses found`
      );

      for (let i = 0; i < expenses.length; i++) {
        const sequenceValue = i + 1;
console.log(
          `Setting sequence ${sequenceValue} for expenseId ${expenses[i].id}`
        );
        await queryInterface.sequelize.query(
          `
          UPDATE expenses
          SET sequence = :sequence
          WHERE id = :id
          `,
          {
            replacements: {
              sequence: sequenceValue,
              id: expenses[i].id,
            },
          }
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE expenses
      SET sequence = 0
    `);
  },
};
