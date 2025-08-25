"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("incomes", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to STRING in case you roll back
    await queryInterface.changeColumn("incomes", "description", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
