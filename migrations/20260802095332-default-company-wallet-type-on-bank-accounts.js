"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE bank_accounts SET walletType = 'COMPANY' WHERE walletType IS NULL",
    );

    await queryInterface.changeColumn("bank_accounts", "walletType", {
      type: Sequelize.ENUM("PERSONAL", "COMPANY"),
      allowNull: false,
      defaultValue: "COMPANY",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("bank_accounts", "walletType", {
      type: Sequelize.ENUM("PERSONAL", "COMPANY"),
      allowNull: true,
      defaultValue: null,
    });
  },
};
