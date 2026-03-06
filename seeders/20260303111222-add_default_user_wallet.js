"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const [users] = await queryInterface.sequelize.query(`
      SELECT id FROM users
    `);

    console.log(
      "Seeding wallets for users:",
      users.map((u) => u.id),
    );
    const now = new Date();
    const wallets = [];

    for (const user of users) {
      wallets.push(
        {
          userId: user.id,
          currency: "CNY",
          walletType: "PERSONAL",
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: user.id,
          currency: "USD",
          walletType: "PERSONAL",
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: user.id,
          currency: "EUR",
          walletType: "PERSONAL",
          createdAt: now,
          updatedAt: now,
        },
      );
    }
    console.log(`Prepared ${wallets.length} wallet records for insertion.`);

    if (wallets.length > 0) {
      console.log("Inserting wallets into database...");
      await queryInterface.bulkInsert("wallets", wallets, {
        ignoreDuplicates: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("wallets", null, {});
  },
};
