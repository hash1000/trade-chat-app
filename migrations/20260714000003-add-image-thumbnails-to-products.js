"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("productImages", "thumbnailUrl", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("productVariationImages", "thumbnailUrl", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    // The ProductFile model maps to product_files, and that table is snake_case
    // throughout (file_url, file_name, s3_key) — so the column follows suit.
    await queryInterface.addColumn("product_files", "thumbnail_url", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("productImages", "thumbnailUrl");
    await queryInterface.removeColumn("productVariationImages", "thumbnailUrl");
    await queryInterface.removeColumn("product_files", "thumbnail_url");
  },
};
