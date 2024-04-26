'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('messages', 'fileUrl', {
      type: Sequelize.STRING,
      allowNull: true
    })

    await queryInterface.addColumn('messages', 'quoteToId', {
      type: Sequelize.INTEGER,
      allowNull: true
    })

    await queryInterface.addColumn('messages', 'isDeleted', {
      type: Sequelize.BOOLEAN,
      allowNull: true
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('messages', 'fileUrl')
    await queryInterface.removeColumn('messages', 'quoteToId')
    await queryInterface.removeColumn('messages', 'isDeleted')
  }
}
