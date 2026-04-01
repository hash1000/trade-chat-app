"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("bank_accounts", "accountCurrency", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await queryInterface.changeColumn("bank_accounts", "currency", {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE bank_accounts
      SET accountCurrency = 'USD'
      WHERE accountCurrency IS NULL OR accountCurrency = ''
    `);

    await queryInterface.sequelize.query(`
      UPDATE bank_accounts
      SET currency = 'USD'
      WHERE currency IS NULL OR currency = ''
    `);

    await queryInterface.changeColumn("bank_accounts", "accountCurrency", {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn("bank_accounts", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    });
  },
};
