"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("wallet_transactions", ["receiverId"], {
      name: "wallet_transactions_receiver_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("wallet_transactions", "wallet_transactions_receiver_id");
  },
};
