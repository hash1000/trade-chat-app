'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   
    await queryInterface.addColumn("ledger",  "archived", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
          defaultValue: false,
    });

    await queryInterface.addColumn("ledger", "sequence", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('ledger', 'archived');
    await queryInterface.removeColumn('ledger', 'sequence');
  }
};
