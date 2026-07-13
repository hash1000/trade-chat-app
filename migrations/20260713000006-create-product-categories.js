"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("product_categories", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      shopProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shopProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      publicCategoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "public_categories", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex("product_categories", ["shopProductId", "publicCategoryId"], {
      unique: true,
      name: "product_categories_product_category_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("product_categories");
  },
};
