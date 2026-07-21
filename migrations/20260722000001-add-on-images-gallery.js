"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("product_add_ons", "image");

    await queryInterface.createTable("productAddOnImages", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      productAddOnId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "product_add_ons", key: "id" },
        onDelete: "CASCADE",
      },
      url: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      thumbnailUrl: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("productAddOnImages", ["productAddOnId"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("productAddOnImages");
    await queryInterface.addColumn("product_add_ons", "image", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
