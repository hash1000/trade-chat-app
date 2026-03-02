"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("wallet_transactions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      walletId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "wallets",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      receiptId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "receipts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      type: {
        type: Sequelize.ENUM(
          "DEPOSIT",
          "WITHDRAW",
          "LOCK",
          "UNLOCK",
          "TRANSFER_IN",
          "TRANSFER_OUT",
          "FX_CONVERT_IN",
          "FX_CONVERT_OUT",
        ),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
      },
      balanceBefore: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: true,
      },
      balanceAfter: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: true,
      },
      meta: {
        // Use JSONB when supported (e.g. Postgres)
        type: Sequelize.JSON,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("wallet_transactions");
  },
};

