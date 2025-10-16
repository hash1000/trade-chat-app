'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bank_accounts', 'intermediateBank', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('bank_accounts', 'beneficiaryAddress', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bank_accounts', 'intermediateBank');
    await queryInterface.removeColumn('bank_accounts', 'beneficiaryAddress');
  },
};
