"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("receipts", "walletType", {
      type: Sequelize.ENUM("PERSONAL", "COMPANY"),
      allowNull: false,
      defaultValue: "PERSONAL",
      after: "currency",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("receipts", "walletType");
  },
};
