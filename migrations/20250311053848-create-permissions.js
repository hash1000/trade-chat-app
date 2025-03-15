"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("permissions", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      resource: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      create: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      readAll: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      readSingle: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      canUpdate: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      canDelete: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      ownData: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      allData: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("permissions");
  },
};
