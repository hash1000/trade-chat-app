"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "userId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await queryInterface.addColumn("services", "price", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: true,
      defaultValue: null,
      after: "description", // MySQL only — remove if using PostgreSQL
    });

    await queryInterface.addColumn("services", "priceCurrency", {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: "USD",
      after: "price", // MySQL only — remove if using PostgreSQL
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("services", "price");
    await queryInterface.removeColumn("services", "priceCurrency");
    await queryInterface.removeColumn("services", "userId");
  },
};