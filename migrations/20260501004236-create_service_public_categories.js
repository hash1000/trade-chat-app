"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {

    await queryInterface.createTable("service_public_categories", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "services",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      publicCategoryId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "public_categories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("service_public_categories", ["serviceId", "publicCategoryId"], {
      unique: true,
      name: "service_public_categories_service_id_public_category_id_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("service_public_categories");
  },
};
