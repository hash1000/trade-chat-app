"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("services", "ratingAvg", {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("services", "ratingAvg", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },
};
