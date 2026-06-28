"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("service_order_add_ons", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      serviceOrderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "service_orders", key: "id" },
        onDelete: "CASCADE",
      },
      addOnId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "service_add_ons", key: "id" },
        onDelete: "RESTRICT",
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      priceAtOrder: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
      subtotal: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
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

    await queryInterface.addIndex("service_order_add_ons", ["serviceOrderId"]);
    await queryInterface.addIndex("service_order_add_ons", ["addOnId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("service_order_add_ons");
  },
};
