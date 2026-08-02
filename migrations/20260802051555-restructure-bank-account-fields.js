"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn(
      "bank_accounts",
      "accountName",
      "bank_name",
    );

    await queryInterface.removeColumn("bank_accounts", "accountHolder");
    await queryInterface.removeColumn("bank_accounts", "intermediateBank");
    await queryInterface.removeColumn("bank_accounts", "beneficiaryAddress");

    await queryInterface.addColumn("bank_accounts", "familyName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "accountNo", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "bank_address", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "intermediate_bank_name", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "intermediate_bank_swift", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "intermediate_bank_address", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "walletType", {
      type: Sequelize.ENUM("PERSONAL", "COMPANY"),
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "isDefault", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("bank_accounts", "isDefault");
    await queryInterface.removeColumn("bank_accounts", "walletType");
    await queryInterface.removeColumn("bank_accounts", "intermediate_bank_address");
    await queryInterface.removeColumn("bank_accounts", "intermediate_bank_swift");
    await queryInterface.removeColumn("bank_accounts", "intermediate_bank_name");
    await queryInterface.removeColumn("bank_accounts", "bank_address");
    await queryInterface.removeColumn("bank_accounts", "accountNo");
    await queryInterface.removeColumn("bank_accounts", "familyName");

    await queryInterface.addColumn("bank_accounts", "beneficiaryAddress", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "intermediateBank", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "accountHolder", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.renameColumn(
      "bank_accounts",
      "bank_name",
      "accountName",
    );
  },
};
