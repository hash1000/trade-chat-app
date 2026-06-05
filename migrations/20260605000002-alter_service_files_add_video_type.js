"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("service_files", "file_type", {
      type: Sequelize.ENUM("image", "video", "pdf", "doc", "docx", "other"),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("service_files", "file_type", {
      type: Sequelize.ENUM("image", "pdf", "doc", "docx", "other"),
      allowNull: false,
    });
  },
};
