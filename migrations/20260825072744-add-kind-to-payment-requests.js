'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // "direct" = created via sendPayment (transfer already happened).
    // "request" = created via sendPaymentRequest, pending accept/reject.
    await queryInterface.addColumn("payment_requests", "kind", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "request",
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("payment_requests", "kind");
  }
};
