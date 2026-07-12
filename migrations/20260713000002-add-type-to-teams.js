"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 'service' teams keep admin involvement; 'shop' teams are private to
    // their creator. All pre-existing teams belong to the service world.
    await queryInterface.addColumn("teams", "type", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "service",
    });
    await queryInterface.addIndex("teams", ["type"]);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("teams", "type");
  },
};
