"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("service_files", "file_type", {
      type: Sequelize.ENUM("video", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "image", "other"),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("service_files", "file_type", {
      type: Sequelize.ENUM("image", "video", "pdf", "doc", "docx", "other"),
      allowNull: false,
    });
  },
};
