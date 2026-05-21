"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable(
      "service_purchases",
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },

        // Buyer
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,

          comment: "Buyer",

          references: {
            model: "users",
            key: "id",
          },

          onUpdate: "CASCADE",

          // Never delete purchases automatically
          onDelete: "RESTRICT",
        },

        serviceId: {
          type: Sequelize.INTEGER,
          allowNull: false,

          references: {
            model: "services",
            key: "id",
          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT",
        },

        // Buyer wallet snapshot
        buyerWalletId: {
          type: Sequelize.INTEGER,
          allowNull: false,

          references: {
            model: "wallets",
            key: "id",
          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT",
        },

        // Seller wallet snapshot
        sellerWalletId: {
          type: Sequelize.INTEGER,
          allowNull: false,

          references: {
            model: "wallets",
            key: "id",
          },

          onUpdate: "CASCADE",

          onDelete: "RESTRICT",
        },

        // Back-reference to buyer transaction
        walletTransactionId: {
          type: Sequelize.INTEGER,
          allowNull: true,

          references: {
            model: "wallet_transactions",
            key: "id",
          },

          onUpdate: "CASCADE",

          onDelete: "SET NULL",
        },

        // Immutable financial snapshot
        amountPaid: {
          type: Sequelize.DECIMAL(20, 8),
          allowNull: false,
        },

        status: {
          type: Sequelize.ENUM(
            "PENDING",
            "COMPLETED",
            "REFUNDED"
          ),

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
      }
    );

    // ─────────────────────────────────────
    // Indexes
    // ─────────────────────────────────────

    await queryInterface.addIndex(
      "service_purchases",
      ["userId"]
    );

    await queryInterface.addIndex(
      "service_purchases",
      ["serviceId"]
    );

    await queryInterface.addIndex(
      "service_purchases",
      ["buyerWalletId"]
    );

    await queryInterface.addIndex(
      "service_purchases",
      ["sellerWalletId"]
    );

    await queryInterface.addIndex(
      "service_purchases",
      ["walletTransactionId"]
    );

    // CRITICAL
    // Prevent duplicate purchases
    await queryInterface.addConstraint(
      "service_purchases",
      {
        fields: ["userId", "serviceId"],

        type: "unique",

        name: "uq_service_purchase_user_service",
      }
    );
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeConstraint(
      "service_purchases",
      "uq_service_purchase_user_service"
    );

    await queryInterface.dropTable(
      "service_purchases"
    );

    // Cleanup ENUM manually in MySQL
    if (queryInterface.sequelize.options.dialect === "mysql") {
      await queryInterface.sequelize.query(
        "DROP TYPE IF EXISTS enum_service_purchases_status;"
      ).catch(() => {});
    }
  },
};