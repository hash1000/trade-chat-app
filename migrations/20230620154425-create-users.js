'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      username: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      settings: {
        type: Sequelize.JSON
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      resetToken: {
        type: Sequelize.STRING,
        unique: true,
        index: true,
        allowNull: true
      },
      tokenVersion:
          {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false
          },
      personalWalletBalance:
          {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false
          },
      companyWalletBalance:
          {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false
          }
    })
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users')
  }
}
