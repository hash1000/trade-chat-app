"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("orders", "paidAmount", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
      after: "price",
    });

    await queryInterface.addColumn("service_orders", "paidAmount", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 0,
      after: "finalAmount",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("orders", "paidAmount");
    await queryInterface.removeColumn("service_orders", "paidAmount");
  },
};
