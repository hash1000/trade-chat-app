'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Links a wallet transaction back to the payment_requests row that
    // caused it (sendPayment / acceptPaymentRequest), so callers can filter
    // "my transactions" by that payment's status (pending/accepted/rejected).
    await queryInterface.addColumn("wallet_transactions", "paymentRequestId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addIndex("wallet_transactions", ["paymentRequestId"]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex("wallet_transactions", ["paymentRequestId"]);
    await queryInterface.removeColumn("wallet_transactions", "paymentRequestId");
  }
};
