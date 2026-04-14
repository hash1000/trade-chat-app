"use strict";
const { generateWalletAccountNumber } = require("../utilities/walletUtils");

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add column nullable first
    await queryInterface.addColumn("wallets", "accountNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // 2. Fill existing rows
    const wallets = await queryInterface.sequelize.query(
      `SELECT * FROM wallets`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    let walletCurrency = {
      USD: "1",
      EUR: "2",
      CNY: "3",
    };
    for (const wallet of wallets) {
      // Check if the currency exists in the mapping
      if (!walletCurrency[wallet.currency]) {
        console.log("Invalid currency:", wallet.currency);
        throw new Error("Currency not supported");
      }
      const accountNumber = generateWalletAccountNumber(
        walletCurrency[wallet.currency],
      ); // import your function
      console.log(accountNumber);
      await queryInterface.sequelize.query(
        `UPDATE wallets SET accountNumber = :accountNumber WHERE id = :id`,
        {
          replacements: { accountNumber, id: wallet.id },
        },
      );
    }

    // 3. Make NOT NULL
    await queryInterface.changeColumn("wallets", "accountNumber", {
      type: Sequelize.STRING(12),
      allowNull: false,
    });

    // 4. Add unique constraint
    await queryInterface.addConstraint("wallets", {
      fields: ["accountNumber"],
      type: "unique",
      name: "unique_account_number_constraint",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      "wallets",
      "unique_account_number_constraint",
    );

    await queryInterface.removeColumn("wallets", "accountNumber");
  },
};
