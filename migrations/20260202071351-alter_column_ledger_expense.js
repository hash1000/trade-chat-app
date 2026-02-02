"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("expenses", "amount", {
      type: Sequelize.DECIMAL(20, 5),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("expenses", "amount", {
      type: Sequelize.FLOAT,
      allowNull: false,
    });
  },
};
