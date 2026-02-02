"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("incomes", "amount", {
      type: Sequelize.DECIMAL(20, 5),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("incomes", "amount", {
      type: Sequelize.FLOAT,
      allowNull: false,
    });
  },
}