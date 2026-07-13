"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("shops", "payoutWalletId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      references: { model: "wallets", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("shops", "payoutWalletId");
  },
};
