'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_accounts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      accountName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      iban: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      accountHolder: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      accountCurrency: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      bic: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      sequence: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('bank_accounts');
  },
};
