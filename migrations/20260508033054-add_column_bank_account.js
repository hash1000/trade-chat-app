"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bank_accounts", "walletId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "wallets",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("bank_accounts", "walletId");
  },
};
