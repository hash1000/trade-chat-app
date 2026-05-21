// migrations/20260521000003-add-reference-fields-to-wallet-transactions.js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("wallet_transactions", "referenceType", {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: "Business entity type that caused this transaction e.g. SERVICE_PURCHASE",
      after: "description", // MySQL only — remove if using PostgreSQL
    });

    await queryInterface.addColumn("wallet_transactions", "referenceId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "PK of the row in the business table referenced by referenceType",
      after: "referenceType", // MySQL only — remove if using PostgreSQL
    });

    // Composite index — always query both together
    await queryInterface.addIndex(
      "wallet_transactions",
      ["referenceType", "referenceId"],
      { name: "wallet_transactions_reference_type_reference_id" }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "wallet_transactions",
      "wallet_transactions_reference_type_reference_id"
    );
    await queryInterface.removeColumn("wallet_transactions", "referenceId");
    await queryInterface.removeColumn("wallet_transactions", "referenceType");
  },
};