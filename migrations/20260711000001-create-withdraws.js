"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("withdraws", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      bankCardId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bank_accounts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      amount: {
        type: Sequelize.DECIMAL(20, 5),
        allowNull: false,
        defaultValue: 0,
      },
      newAmount: {
        type: Sequelize.DECIMAL(20, 5),
        allowNull: true,
        defaultValue: null,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: "USD",
      },
      walletType: {
        type: Sequelize.ENUM("PERSONAL", "COMPANY"),
        allowNull: false,
        defaultValue: "PERSONAL",
      },
      note: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      adminNote: {
        type: Sequelize.STRING(1000),
        allowNull: true,
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
      processedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      userStatus: {
        type: Sequelize.ENUM("success", "paid", "refunded"),
        allowNull: false,
        defaultValue: "success",
      },
      adminStatus: {
        type: Sequelize.ENUM("pending", "paid", "refunded"),
        allowNull: false,
        defaultValue: "pending",
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
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex("withdraws", ["userId"]);
    await queryInterface.addIndex("withdraws", ["adminStatus"]);
    await queryInterface.addIndex("withdraws", ["createdAt"]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("withdraws");
  },
};
