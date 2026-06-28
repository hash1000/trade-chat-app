"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("service_orders", "serviceOwnerId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "serviceId",
    }).catch(() => {});

    await queryInterface.addColumn("service_orders", "status", {
      type: Sequelize.ENUM("PENDING", "PURCHASED", "REFUNDED"),
      allowNull: false,
      defaultValue: "PENDING",
      after: "finalAmount",
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("service_orders", "status").catch(() => {});
    await queryInterface.removeColumn("service_orders", "serviceOwnerId").catch(() => {});
  },
};
