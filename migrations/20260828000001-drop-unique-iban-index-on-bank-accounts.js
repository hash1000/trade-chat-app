"use strict";

// The original create_bank_accounts migration added iban as `unique: true`.
// A later migration set the column to `unique: false` via changeColumn, but
// MySQL/Sequelize's changeColumn does not drop an existing unique index, so the
// `iban` unique index has been lingering. That makes a second bank account with
// an empty (or null-coerced-to-'') iban fail with ER_DUP_ENTRY. iban is optional
// and no longer meant to be unique, so drop the index.
module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex("bank_accounts");

    if (indexes.some((index) => index.name === "iban")) {
      await queryInterface.removeIndex("bank_accounts", "iban");
    }
  },

  async down(queryInterface) {
    const indexes = await queryInterface.showIndex("bank_accounts");

    if (!indexes.some((index) => index.name === "iban")) {
      await queryInterface.addIndex("bank_accounts", ["iban"], {
        name: "iban",
        unique: true,
      });
    }
  },
};
