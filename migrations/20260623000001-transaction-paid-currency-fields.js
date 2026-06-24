"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Rename usdAmount → paidAmount (preserves existing data)
    await queryInterface.renameColumn("transaction", "usdAmount", "paidAmount");

    // Add paidCurrency to record what currency Stripe actually charged in
    await queryInterface.addColumn("transaction", "paidCurrency", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "USD", // existing rows were all USD top-ups
      after: "paidAmount",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("transaction", "paidCurrency");
    await queryInterface.renameColumn("transaction", "paidAmount", "usdAmount");
  },
};
