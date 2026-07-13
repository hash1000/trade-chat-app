"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("shops", "leadTime", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.removeColumn("productVariations", "leadTime");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("productVariations", "leadTime", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.removeColumn("shops", "leadTime");
  },
};
