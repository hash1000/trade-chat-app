"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("bank_accounts", "accountName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("bank_accounts", "accountName");
  },
};
