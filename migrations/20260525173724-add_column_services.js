"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    // Add pricing_type ENUM
    await queryInterface.addColumn("services", "pricing_type", {
      type: Sequelize.ENUM("free", "fixed", "range"),
      allowNull: false,
      defaultValue: "fixed",
    });

    // Add min_price
    await queryInterface.addColumn("services", "min_price", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });

    // Add max_price
    await queryInterface.addColumn("services", "max_price", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    
    await queryInterface.removeColumn("services", "pricing_type");

    await queryInterface.removeColumn("services", "min_price");

    await queryInterface.removeColumn("services", "max_price");

    // Cleanup ENUM type for PostgreSQL
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_services_pricing_type";'
    );
  },
};