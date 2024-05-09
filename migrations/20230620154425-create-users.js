"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "user",
      },
      country_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      gender: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      age: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      profilePic: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      settings: {
        type: Sequelize.JSON,
        defaultValue: {
          password: "12345678",
          tags: ["tag1", "tag2"],
          emails: ["example@example.com"],
          phoneNumbers: ["1234567890"],
          description: "Default description",
        },
      },
      friendShip: {
        type: Sequelize.JSON,
        defaultValue: {
          type: "defaultType",
          userId: 0,
          profileId: 0,
        },
      },
      createdAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      resetToken: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      fcm: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      tokenVersion: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      likes: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      dislikes: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      is_online: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      last_login: {
        type: Sequelize.BIGINT,
        defaultValue: 0,
      },
      personalWalletBalance: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      companyWalletBalance: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      otp: {
        type: Sequelize.STRING,
        allowNull: true,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("users");
  },
};
