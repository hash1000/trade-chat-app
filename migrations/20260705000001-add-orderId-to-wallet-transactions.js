"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("wallet_transactions", "orderId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "referenceId",
    });

    await queryInterface.addIndex("wallet_transactions", ["orderId"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("wallet_transactions", ["orderId"]);
    await queryInterface.removeColumn("wallet_transactions", "orderId");
  },
};
