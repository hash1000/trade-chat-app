"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("incomes", "paymentTypeId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "payment_types",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("incomes", "paymentTypeId");
  },
};
