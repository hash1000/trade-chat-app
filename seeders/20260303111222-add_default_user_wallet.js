"use strict";

const { Wallet } = require("../models");
const { User } = require("../models");

module.exports = {
  async up(queryInterface, Sequelize) {
    const [users] = await queryInterface.sequelize.query(`
      SELECT id FROM users
    `);

    const now = new Date();  // Get the current timestamp

    for (const user of users) {
      // Create wallets for each user (CNY, USD, EUR)
      const wallets = [
        { userId: user.id, currency: 'CNY', walletType: 'PERSONAL', createdAt: now, updatedAt: now },
        { userId: user.id, currency: 'USD', walletType: 'PERSONAL', createdAt: now, updatedAt: now },
        { userId: user.id, currency: 'EUR', walletType: 'PERSONAL', createdAt: now, updatedAt: now },
      ];

      // Insert the wallets into the database
      await queryInterface.bulkInsert('wallets', wallets);
    }
  },

  async down(queryInterface, Sequelize) {
    // Optionally delete the wallets in case you want to rollback
    await queryInterface.bulkDelete('wallets', null, {});
  }
};