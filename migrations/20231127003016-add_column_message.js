'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'settings', {
      type: Sequelize.JSON,
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('messages', 'settings')
  }
}
