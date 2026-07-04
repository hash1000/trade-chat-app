"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("versions", "changelog", {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      after: "version",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("versions", "changelog");
  },
};
