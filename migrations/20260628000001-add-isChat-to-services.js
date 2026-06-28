"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "isChat", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: "support247",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("services", "isChat");
  },
};
