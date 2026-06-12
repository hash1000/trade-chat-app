"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "replyTime", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: "false",
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("services", "replyTime");
  },
};
