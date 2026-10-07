"use strict";

// `Receipt.isLock` was in the model but never got a migration, so databases built
// from migrations alone (the test server) failed every receipt query with
// "Unknown column 'Receipt.isLock'". Skips when the column already exists.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("receipts");
    if (table.isLock) return;
    await queryInterface.addColumn("receipts", "isLock", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "note",
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("receipts");
    if (table.isLock) await queryInterface.removeColumn("receipts", "isLock");
  },
};
