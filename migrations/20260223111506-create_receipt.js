"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("receipts", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      senderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "bank_accounts", // Reference the 'bank_accounts' table
          key: "id", // Reference the 'id' field of the 'bank_accounts' table
        },
        onUpdate: "CASCADE", // Define action when referenced record is updated
        onDelete: "RESTRICT", // Prevent deleting a bank_account while receipts reference it
      },
      receiverId: {
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
        defaultValue: 0,
      },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: "users",
          key: "id",
        },
      },
      approvedBy: {
        allowNull: true, // ✅ allow null
        type: Sequelize.INTEGER,
        defaultValue: null, // ✅ default null
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL", // ✅ important when user is deleted
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
    await queryInterface.dropTable("receipts");
  },
};
