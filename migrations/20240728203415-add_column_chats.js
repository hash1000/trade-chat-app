'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('chats', 'friendName', {
      type: Sequelize.JSON,
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('chats', 'friendName')
  }
};
