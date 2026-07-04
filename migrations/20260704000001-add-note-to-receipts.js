"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("receipts", "note", {
      type: Sequelize.STRING(1000),
      allowNull: true,
      after: "walletType",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receipts", "note");
  },
};
