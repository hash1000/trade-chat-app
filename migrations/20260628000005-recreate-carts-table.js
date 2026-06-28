"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop old single-product carts table if it exists, then recreate for multi-cart system
    await queryInterface.dropTable("carts").catch(() => {});

    await queryInterface.createTable("carts", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("active", "converted", "abandoned"),
        allowNull: false,
        defaultValue: "active",
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

    await queryInterface.addIndex("carts", ["userId"]);
    await queryInterface.addIndex("carts", ["userId", "status"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("carts");
  },
};
