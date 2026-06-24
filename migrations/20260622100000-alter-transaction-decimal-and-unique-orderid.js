"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("transaction", "amount", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
    });
    await queryInterface.changeColumn("transaction", "usdAmount", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
    });
    await queryInterface.changeColumn("transaction", "rate", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
    });
    await queryInterface.addIndex("transaction", ["orderId"], {
      unique: true,
      name: "transaction_orderId_unique",
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex("transaction", "transaction_orderId_unique");
    await queryInterface.changeColumn("transaction", "amount", {
      type: Sequelize.FLOAT,
      allowNull: false,
    });
    await queryInterface.changeColumn("transaction", "usdAmount", {
      type: Sequelize.FLOAT,
      allowNull: false,
    });
    await queryInterface.changeColumn("transaction", "rate", {
      type: Sequelize.FLOAT,
      allowNull: false,
    });
  },
};
