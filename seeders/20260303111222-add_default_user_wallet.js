"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const [users] = await queryInterface.sequelize.query(`
      SELECT id FROM users
    `);

    const now = new Date();
    const wallets = [];

    for (const user of users) {
      wallets.push(
        { userId: user.id, currency: "CNY", walletType: "PERSONAL", createdAt: now, updatedAt: now },
        { userId: user.id, currency: "USD", walletType: "PERSONAL", createdAt: now, updatedAt: now },
        { userId: user.id, currency: "EUR", walletType: "PERSONAL", createdAt: now, updatedAt: now }
      );
    }

    if (wallets.length > 0) {
      await queryInterface.bulkInsert("wallets", wallets);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("wallets", null, {});
  }
};