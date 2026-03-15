"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("teams", "profile_image", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "",
    });
    
    await queryInterface.removeColumn("teams", "type");
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("teams", "profile_image");
    await queryInterface.addColumn("teams", "type");
  },
};
