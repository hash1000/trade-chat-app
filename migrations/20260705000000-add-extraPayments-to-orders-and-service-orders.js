"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("orders", "extraPayments", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
      after: "paidAmount",
    });

    await queryInterface.addColumn("service_orders", "extraPayments", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
      after: "paidAmount",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("orders", "extraPayments");
    await queryInterface.removeColumn("service_orders", "extraPayments");
  },
};
