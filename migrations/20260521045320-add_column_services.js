"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // STEP 1
    // Add nullable first

    await queryInterface.addColumn(
      "services",
      "userId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      }
    );

    // STEP 2
    // TEMP BACKFILL
    // Assign all existing services to user 1
    // (adjust if needed)

    await queryInterface.sequelize.query(`
      UPDATE services
      SET userId = 1
      WHERE userId IS NULL
    `);

    // STEP 3
    // Add FK constraint

    await queryInterface.changeColumn(
      "services",
      "userId",
      {
        type: Sequelize.INTEGER,

        allowNull: false,

        references: {
          model: "users",
          key: "id",
        },

        onUpdate: "CASCADE",

        onDelete: "RESTRICT",
      }
    );

    // STEP 4
    // payoutWalletId

    await queryInterface.addColumn(
      "services",
      "payoutWalletId",
      {
        type: Sequelize.INTEGER,
        allowNull: true,
      }
    );

    // TEMP BACKFILL
    // Example wallet id 1
    // adjust according to your DB

    await queryInterface.sequelize.query(`
      UPDATE services
      SET payoutWalletId = 1
      WHERE payoutWalletId IS NULL
    `);

    await queryInterface.changeColumn(
      "services",
      "payoutWalletId",
      {
        type: Sequelize.INTEGER,

        allowNull: false,

        references: {
          model: "wallets",
          key: "id",
        },

        onUpdate: "CASCADE",

        onDelete: "RESTRICT",
      }
    );

    // STEP 5
    // price

    await queryInterface.addColumn(
      "services",
      "price",
      {
        type: Sequelize.DECIMAL(20, 8),

        allowNull: true,
      }
    );

    // TEMP BACKFILL

    await queryInterface.sequelize.query(`
      UPDATE services
      SET price = 0
      WHERE price IS NULL
    `);

    await queryInterface.changeColumn(
      "services",
      "price",
      {
        type: Sequelize.DECIMAL(20, 8),

        allowNull: false,
      }
    );
  },

  async down(queryInterface) {

    await queryInterface.removeColumn(
      "services",
      "price"
    );

    await queryInterface.removeColumn(
      "services",
      "payoutWalletId"
    );

    await queryInterface.removeColumn(
      "services",
      "userId"
    );
  },
};