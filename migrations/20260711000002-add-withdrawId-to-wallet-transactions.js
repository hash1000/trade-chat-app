"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("wallet_transactions", "withdrawId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "receiptId",
    });

    await queryInterface.addIndex("wallet_transactions", ["withdrawId"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("wallet_transactions", ["withdrawId"]);
    await queryInterface.removeColumn("wallet_transactions", "withdrawId");
  },
};
