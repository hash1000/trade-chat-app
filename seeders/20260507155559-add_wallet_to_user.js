"use strict";

const {
  generateWalletAccountNumber,
} = require("../utilities/walletUtils");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      const users = await queryInterface.sequelize.query(
        `SELECT id FROM users`,
        {
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      const walletCurrency = {
        USD: "1",
        EUR: "2",
        CNY: "3",
      };

      const currencies = Object.keys(walletCurrency);

      const walletsToInsert = [];

      for (const user of users) {
        for (const currency of currencies) {
          walletsToInsert.push({
            userId: user.id,
            currency,
            walletType: "COMPANY",
            availableBalance: 0,
            lockedBalance: 0,
            accountNumber: generateWalletAccountNumber(
              walletCurrency[currency]
            ).slice(0, 20),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }

      if (walletsToInsert.length > 0) {
        await queryInterface.bulkInsert("wallets", walletsToInsert);
      }

      console.log(
        `Successfully seeded ${walletsToInsert.length} company wallets`
      );
    } catch (error) {
      console.error("Error seeding wallets:", error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete(
      "wallets",
      {
        walletType: "COMPANY",
      },
      {}
    );
  },
};