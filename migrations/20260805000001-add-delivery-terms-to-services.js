"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "delivery_terms", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "DDP — Delivered Duty Paid",
      after: "replyTime",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("services", "delivery_terms");
  },
};
