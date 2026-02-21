'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
       await queryInterface.addColumn("receipts", "status", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("receipts", "status");
  }
};
