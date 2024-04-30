'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'firstName', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('users', 'lastName', {
      type: Sequelize.STRING,
      allowNull: true
    })
    await queryInterface.addColumn('users', 'username', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'firstName')
    await queryInterface.removeColumn('users', 'lastName')
    await queryInterface.removeColumn('users', 'username')

  }
}
