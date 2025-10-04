'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add the 'fromLogin' column with ENUM type to the 'users' table
    await queryInterface.addColumn('users', 'fromLogin', {
      type: Sequelize.ENUM('EMAIL', 'SIMPLE', 'TWITTER' , 'IOS', 'FACEBOOK'),
      allowNull: false,
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove the 'fromLogin' column if the migration is rolled back
    await queryInterface.removeColumn('users', 'fromLogin');
  }
};
