"use strict";

// receipts.currency existed on the working DB but was never captured by a
// migration (likely added by hand). Guarded so it's a no-op where it exists.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("receipts");
    if (!table.currency) {
      await queryInterface.addColumn("receipts", "currency", {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "USD",
        after: "newAmount",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receipts", "currency");
  },
};
