'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'likes', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
    await queryInterface.addColumn('users', 'dislikes', {
      type: Sequelize.INTEGER,
      defaultValue: 0
    })
    await queryInterface.addColumn('users', 'last_login', {
      type: Sequelize.BIGINT,
      defaultValue: 0
    })
    await queryInterface.addColumn('users', 'is_online', {
      type: Sequelize.BOOLEAN,
      defaultValue: 0
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'likes')
    await queryInterface.removeColumn('users', 'dislikes')
    await queryInterface.removeColumn('users', 'last_login')
    await queryInterface.removeColumn('users', 'is_online')
  }
}
