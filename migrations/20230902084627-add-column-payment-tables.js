'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('payments', 'confirmedAmount', {
      type: Sequelize.FLOAT,
      allowNull: true
    })

    await queryInterface.addColumn('payments', 'status', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'pending'
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('payments', 'confirmedAmount')
    await queryInterface.removeColumn('payments', 'status')
  }
}
