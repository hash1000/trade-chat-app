'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      role: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'user'
      },
      country_code: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true
      },
      profilePic: {
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
      fcm: {
        type: Sequelize.STRING,
        allowNull: true
      },
      tokenVersion: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      likes: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      dislikes: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      last_login: {
        type: Sequelize.BIGINT,
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
      otp: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('users');
  }
};
