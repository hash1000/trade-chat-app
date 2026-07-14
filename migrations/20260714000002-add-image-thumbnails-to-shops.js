"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("shops", "header_image_thumbnail", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("shops", "profile_image_thumbnail", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("shopImages", "thumbnailUrl", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("shops", "header_image_thumbnail");
    await queryInterface.removeColumn("shops", "profile_image_thumbnail");
    await queryInterface.removeColumn("shopImages", "thumbnailUrl");
  },
};
