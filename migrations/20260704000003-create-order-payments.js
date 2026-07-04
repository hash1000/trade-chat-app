"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("order_payments", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "orders", key: "id" },
        onDelete: "CASCADE",
      },
      serviceOrderId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "service_orders", key: "id" },
        onDelete: "SET NULL",
      },
      type: {
        type: Sequelize.ENUM("order_payment", "order_top_up"),
        allowNull: false,
        defaultValue: "order_payment",
      },
      amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
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

    await queryInterface.addIndex("order_payments", ["orderId"]);
    await queryInterface.addIndex("order_payments", ["serviceOrderId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("order_payments");
  },
};
