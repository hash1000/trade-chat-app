"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("service_orders", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "services", key: "id" },
        onDelete: "RESTRICT",
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      servicePriceAtOrder: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
      subtotal: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
      discountCode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      discountPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      finalAmount: {
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

    await queryInterface.addIndex("service_orders", ["orderId"]);
    await queryInterface.addIndex("service_orders", ["serviceId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("service_orders");
  },
};
