"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("user", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to STRING in case you roll back
    await queryInterface.changeColumn("users", "description", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
