'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Supports "request without amount" (QR request-payment flow): the
    // requester can ask for money without naming a figure, and the
    // requestee supplies the amount when they accept.
    await queryInterface.changeColumn("payment_requests", "amount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("payment_requests", "amount", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });
  },
};
