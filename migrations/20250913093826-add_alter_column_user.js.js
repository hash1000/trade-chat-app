"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Remove the old column
    await queryInterface.removeColumn("users", "is_online");

    // 2. Add new columns
    await queryInterface.addColumn("users", "email_verified", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn("users", "phoneNumber_verified", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await queryInterface.addColumn("users", "is_completed", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert changes

    // 1. Add back is_online
    await queryInterface.addColumn("users", "is_online", {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    // 2. Remove the new columns
    await queryInterface.removeColumn("users", "email_verified");
    await queryInterface.removeColumn("users", "phoneNumber_verified");
    await queryInterface.removeColumn("users", "is_completed");
  },
};
