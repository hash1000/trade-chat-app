"use strict";

// receipts.currency existed on the working DB but was never captured by a
// migration (likely added by hand), so a fresh database fails on
// 20260703000001-add-walletType-to-receipts.js which does `after: "currency"`.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("receipts", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "USD",
      after: "newAmount",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receipts", "currency");
  },
};
