"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [users] = await queryInterface.sequelize.query(
        `
        SELECT id, personalWalletBalance, usdWalletBalance
        FROM users
        `,
        { transaction },
      );
      console.log(
        "Backfilling wallets for users:",
        users.map((u) => u),
      );

      const now = new Date();
      const missingWallets = [];

      for (const user of users) {
        const userId = user.id;
        const [existingWallets] = await queryInterface.sequelize.query(
          `
          SELECT *
          FROM wallets
          WHERE userId = :userId
          `,
          {
            replacements: { userId },
            transaction,
          },
        );
        console.log(`User ${user.id} existing wallets:`, existingWallets);

        const existingCurrencies = new Set(
          existingWallets.map((wallet) => wallet.currency),
        );
        console.log(`User ${user.id} existing wallets:`, existingCurrencies);

        for (const currency of ["CNY", "USD", "EUR"]) {
          if (!existingCurrencies.has(currency)) {
            missingWallets.push({
              userId: user.id,
              currency,
              walletType: "PERSONAL",
              availableBalance: 0,
              lockedBalance: 0,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
      console.log(`Total missing wallets to insert: ${missingWallets.length}`);

      if (missingWallets.length > 0) {
        await queryInterface.bulkInsert("wallets", missingWallets, {
          transaction,
        });
      }

      for (const user of users) {
        console.log(`Processing user ${user.id} with balances: personalWalletBalance=${user.personalWalletBalance}, usdWalletBalance=${user.usdWalletBalance}`);
  const personalBalance = parseFloat(user.personalWalletBalance);
  const usdBalance = parseFloat(user.usdWalletBalance);

  console.log(`Updating balances for user ${user.id}: personalWalletBalance=${personalBalance}, usdWalletBalance=${usdBalance}`);
  if (!isNaN(personalBalance)) {
    await queryInterface.sequelize.query(
      `
      UPDATE wallets
      SET availableBalance = :balance
      WHERE userId = :userId
        AND currency = :currency
      `,
      {
        replacements: {
          userId: user.id,
          balance: personalBalance, // Ensure it's a valid number
          currency: "CNY",
        },
        transaction,
      }
    );
  } else {
    console.log(`Invalid personalWalletBalance for user ${user.id}: ${user.personalWalletBalance}`);
  }

  if (!isNaN(usdBalance)) {
    await queryInterface.sequelize.query(
      `
      UPDATE wallets
      SET availableBalance = :balance
      WHERE userId = :userId
        AND currency = :currency
      `,
      {
        replacements: {
          userId: user.id,
          balance: usdBalance, // Ensure it's a valid number
          currency: "USD",
        },
        transaction,
      }
    );
  } else {
    console.log(`Invalid usdWalletBalance for user ${user.id}: ${user.usdWalletBalance}`);
  }
}

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down() {
    // Irreversible: wallet balances may have changed after this backfill ran.
  },
};
