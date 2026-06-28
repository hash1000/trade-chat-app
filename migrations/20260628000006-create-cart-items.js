"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("cart_items", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      cartId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "carts", key: "id" },
        onDelete: "CASCADE",
      },
      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "services", key: "id" },
        onDelete: "CASCADE",
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      servicePriceSnapshot: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      discountCode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      discountPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      addOns: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: "[]",
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

    await queryInterface.addIndex("cart_items", ["cartId"]);
    await queryInterface.addIndex("cart_items", ["cartId", "serviceId"], { unique: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("cart_items");
  },
};
