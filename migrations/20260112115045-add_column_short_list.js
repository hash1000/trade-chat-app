'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('shortLists', 'type', {
      type: Sequelize.ENUM("CHECKMARK", "NUMBERS", "BULLETS", "STEPS", "TASK"),
      allowNull: false, // Adjust this based on your requirements
      defaultValue: "NUMBERS", // Default value for existing rows (optional)
    });

  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('shortLists', 'type');
  }
};
