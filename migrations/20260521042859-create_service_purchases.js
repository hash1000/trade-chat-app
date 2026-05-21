// migrations/20260521000002-create-service-purchases.js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("service_purchases", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "Buyer",
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "services", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      walletTransactionId: {
        type: Sequelize.INTEGER,
        allowNull: true, // filled after wallet transaction is created
        references: { model: "wallet_transactions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      amountPaid: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
       serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "services", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("PENDING", "COMPLETED", "REFUNDED"),
        allowNull: false,
        defaultValue: "COMPLETED",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Indexes
    await queryInterface.addIndex("service_purchases", ["userId"]);
    await queryInterface.addIndex("service_purchases", ["serviceId"]);
    await queryInterface.addIndex("service_purchases", ["userId", "serviceId"]);
    await queryInterface.addIndex("service_purchases", ["walletTransactionId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("service_purchases");
  },
};