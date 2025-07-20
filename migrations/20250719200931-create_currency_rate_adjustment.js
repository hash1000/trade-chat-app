"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("currencyRateAdjustment", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      baseCurrency: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      targetCurrency: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      fetchedRate: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      adjustment: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      finalRate: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      updatedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("currencyRateAdjustment");
  },
};
