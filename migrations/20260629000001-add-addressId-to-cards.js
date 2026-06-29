"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("cards", "addressId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "address", key: "id" },
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("cards", "addressId");
  },
};
