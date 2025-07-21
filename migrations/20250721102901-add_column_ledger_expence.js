"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("expenses", "paymentTypeId", {
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
    await queryInterface.removeColumn("expenses", "paymentTypeId");
  },
};
