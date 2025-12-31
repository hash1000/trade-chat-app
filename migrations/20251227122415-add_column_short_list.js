'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('shortLists', 'pin', {
      type: Sequelize.BOOLEAN,
      allowNull: true, // Adjust this based on your requirements
      defaultValue: false, // Default value for existing rows (optional)
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('shortLists', 'pin');
  }
};
