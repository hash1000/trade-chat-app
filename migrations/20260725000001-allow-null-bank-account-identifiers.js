"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("bank_accounts", "accountName", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("bank_accounts", "swift_code", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("bank_accounts", "bic", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("bank_accounts", "accountName", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("bank_accounts", "swift_code", {
      type: Sequelize.STRING,
      allowNull: false,
    });
    await queryInterface.changeColumn("bank_accounts", "bic", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
