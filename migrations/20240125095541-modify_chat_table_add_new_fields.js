'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('chats', 'lastReadUser1Id', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
    await queryInterface.addColumn('chats', 'lastReadUser2Id', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('chats', 'lastReadUser1Id')
    await queryInterface.removeColumn('chats', 'lastReadUser2Id')
  }
}
