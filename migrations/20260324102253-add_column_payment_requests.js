'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
     await queryInterface.addColumn("payment_requests", "currency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "CNY",
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("payment_requests", "currency");
  }
};

