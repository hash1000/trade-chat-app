"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "deletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn("services", "deletedBy", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "User who deleted this service",
    });

    // Optional but recommended index for performance
    await queryInterface.addIndex("services", ["deletedAt"]);
    await queryInterface.addIndex("services", ["deletedBy"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("services", ["deletedAt"]);
    await queryInterface.removeIndex("services", ["deletedBy"]);

    await queryInterface.removeColumn("services", "deletedAt");
    await queryInterface.removeColumn("services", "deletedBy");
  },
};