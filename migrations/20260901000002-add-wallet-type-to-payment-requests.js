'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Records which wallet the transfer was (or should be) made against.
    // Previously this only ever existed as a transient param passed into
    // sendPayment/acceptPaymentRequest and was discarded after the wallet
    // transfer — this persists it on the request/payment record itself.
    await queryInterface.addColumn("payment_requests", "walletType", {
      type: Sequelize.ENUM("PERSONAL", "COMPANY"),
      allowNull: false,
      defaultValue: "PERSONAL",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("payment_requests", "walletType");
  },
};
