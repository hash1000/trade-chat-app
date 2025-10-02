"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Add the column first
    await queryInterface.addColumn("ledger",  "addNote", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
  async down(queryInterface, Sequelize) {
    // Step 2: Remove the column
    await queryInterface.removeColumn("ledger", "addNote");
  },
};
