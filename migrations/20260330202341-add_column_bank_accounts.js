"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bank_accounts", "testCard", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn("bank_accounts", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "USD",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("bank_accounts", "testCard");
    await queryInterface.removeColumn("bank_accounts", "currency");
  },
};
