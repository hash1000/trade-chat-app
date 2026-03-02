"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("wallets", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
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
      currency: {
        type: Sequelize.STRING(3), // "USD", "EUR", "CNY", etc.
        allowNull: false,
      },
      walletType: {
        type: Sequelize.ENUM("PERSONAL", "COMPANY"),
        allowNull: false,
        defaultValue: "PERSONAL",
      },
      availableBalance: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      lockedBalance: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
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

    // Ensure a user has at most one wallet per (currency, walletType)
    await queryInterface.addConstraint("wallets", {
      fields: ["userId", "currency", "walletType"],
      type: "unique",
      name: "wallets_user_currency_type_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("wallets");
  },
};

