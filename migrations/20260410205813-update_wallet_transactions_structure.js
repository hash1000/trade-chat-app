"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add transaction_group_id
    await queryInterface.addColumn(
      "wallet_transactions",
      "transaction_group_id",
      {
        type: Sequelize.UUID,
        allowNull: true,
      },
    );

    // STEP 1: expand enum
    await queryInterface.changeColumn("wallet_transactions", "type", {
      type: Sequelize.ENUM(
        "DEPOSIT",
        "WITHDRAW",
        "LOCK",
        "UNLOCK",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "FX_CONVERT_IN",
        "FX_CONVERT_OUT",
        "TRANSFER",
        "CONVERT",
      ),
      allowNull: false,
    });

    // STEP 2: update data
    await queryInterface.sequelize.query(`
  UPDATE wallet_transactions
  SET type = 'TRANSFER'
  WHERE type IN ('TRANSFER_IN', 'TRANSFER_OUT');
`);

    await queryInterface.sequelize.query(`
  UPDATE wallet_transactions
  SET type = 'CONVERT'
  WHERE type IN ('FX_CONVERT_IN', 'FX_CONVERT_OUT');
`);

    // STEP 3: shrink enum
    await queryInterface.changeColumn("wallet_transactions", "type", {
      type: Sequelize.ENUM(
        "DEPOSIT",
        "WITHDRAW",
        "LOCK",
        "UNLOCK",
        "TRANSFER",
        "CONVERT",
      ),
      allowNull: false,
    });
    // 4. Remove balance columns
    await queryInterface.removeColumn("wallet_transactions", "balanceBefore");
    await queryInterface.removeColumn("wallet_transactions", "balanceAfter");

    // 7. Add indexes
    await queryInterface.addIndex("wallet_transactions", [
      "transaction_group_id",
    ]);
    await queryInterface.addIndex("wallet_transactions", ["walletId"]);
    await queryInterface.addIndex("wallet_transactions", ["userId"]);
    await queryInterface.addIndex("wallet_transactions", ["receiptId"]);
    await queryInterface.addIndex("wallet_transactions", ["createdAt"]);
    await queryInterface.addIndex("wallet_transactions", [
      "walletId",
      "createdAt",
    ]);
    await queryInterface.addIndex("wallet_transactions", [
      "userId",
      "createdAt",
    ]);
  },

  async down(queryInterface, Sequelize) {
    // 1. Remove indexes
    await queryInterface.removeIndex("wallet_transactions", [
      "transaction_group_id",
    ]);
    await queryInterface.removeIndex("wallet_transactions", ["walletId"]);
    await queryInterface.removeIndex("wallet_transactions", ["userId"]);
    await queryInterface.removeIndex("wallet_transactions", ["receiptId"]);
    await queryInterface.removeIndex("wallet_transactions", ["createdAt"]);
    await queryInterface.removeIndex("wallet_transactions", [
      "walletId",
      "createdAt",
    ]);
    await queryInterface.removeIndex("wallet_transactions", [
      "userId",
      "createdAt",
    ]);

    // 2. Revert ENUM values
    await queryInterface.changeColumn("wallet_transactions", "type", {
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
    });

    // 3. Add back removed columns
    await queryInterface.addColumn("wallet_transactions", "balanceBefore", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: true,
    });

    await queryInterface.addColumn("wallet_transactions", "balanceAfter", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: true,
    });

    // 4. Remove new column
    await queryInterface.removeColumn(
      "wallet_transactions",
      "transaction_group_id",
    );

    // 5. Remove performedBy
    await queryInterface.removeColumn("wallet_transactions", "performedBy");

    // 6. Revert meta (same JSON in MySQL)
    await queryInterface.changeColumn("wallet_transactions", "meta", {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },
};
