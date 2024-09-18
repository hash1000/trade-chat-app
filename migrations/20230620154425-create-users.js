"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      firstName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      lastName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      role: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: "user",
      },
      country_code: {
        type: Sequelize.STRING,
        allowNull: true,
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
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      settings: {
        type: Sequelize.JSON, // Changed to JSONB assuming your database supports it for better performance
        defaultValue: {
          paymentCode: "defaultPaymentCode", // Added paymentCode field
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
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
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
        defaultValue: 10,
      },
      dislikes: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
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
      expiration_time: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("users");
  },
};
