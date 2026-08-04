"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("bank_accounts", "accountHolder", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "firstName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "lastName", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn("bank_accounts", "documentType", {
      type: Sequelize.ENUM("passport", "id_card"),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("bank_accounts", "documentType");
    await queryInterface.removeColumn("bank_accounts", "lastName");
    await queryInterface.removeColumn("bank_accounts", "firstName");

    await queryInterface.changeColumn("bank_accounts", "accountHolder", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
