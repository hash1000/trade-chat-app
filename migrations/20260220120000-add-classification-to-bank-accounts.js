"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add classification enum column to bank_accounts
    await queryInterface.addColumn("bank_accounts", "classification", {
      type: Sequelize.ENUM("sender", "receiver", "both"),
      allowNull: false,
      defaultValue: "both",
    });

    await queryInterface.changeColumn("bank_accounts", "iban", {
      type: Sequelize.STRING,
      allowNull: true, // Set allowNull to true
      unique: false, // Remove unique constraint (this will be done by changing the column)
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("bank_accounts", "classification");
    await queryInterface.changeColumn("bank_accounts", "iban", {
      type: Sequelize.STRING,
      allowNull: false, // Reverting back to allowNull: false
      unique: true, // Adding the unique constraint back
    });
  },
};
