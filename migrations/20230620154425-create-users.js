'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
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
        type: Sequelize.JSON,
        defaultValue: {
          password: [],
          tags: [],
          emails: [],
          phoneNumbers: [],
          description: 'sample description'
        }
      },
      friendShip: {
        type: Sequelize.JSON,
        defaultValue: {
          type: "type",
          userId: 12345,
          profileId: 123
        }
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      resetToken: {
        type: Sequelize.STRING,
        allowNull: true
      },
      tokenVersion: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      personalWalletBalance: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      companyWalletBalance: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
