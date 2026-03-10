"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add currency column if it doesn't exist yet
    await queryInterface.addColumn("receipts", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    });

    // Add isLock column to control whether amount goes to locked balance
    await queryInterface.addColumn("receipts", "isLock", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("receipts", "isLock");
    await queryInterface.removeColumn("receipts", "currency");
  },
};

