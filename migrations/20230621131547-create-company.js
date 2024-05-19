'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('companies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      companyName: {
        allowNull: true,
        type: Sequelize.STRING
      },
      managerFirstName: {
        allowNull: true,
        type: Sequelize.STRING
      },
      managerLastName: {
        allowNull: true,
        type: Sequelize.STRING
      },
      companyPhone: {
        allowNull: true,
        type: Sequelize.STRING
      },
      companyAddress: {
        allowNull: true,
        type: Sequelize.STRING
      },
      companyCountry: {
        allowNull: true,
        type: Sequelize.STRING
      },
      companyCity: {
        allowNull: true,
        type: Sequelize.STRING
      },
      companyZip: {
        allowNull: true,
        type: Sequelize.STRING
      },
      deliveryAddress: {
        allowNull: true,
        type: Sequelize.STRING
      },
      deliveryCountry: {
        allowNull: true,
        type: Sequelize.STRING
      },
      deliveryCity: {
        allowNull: true,
        type: Sequelize.STRING
      },
      deliveryZip: {
        allowNull: true,
        type: Sequelize.STRING
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'users', // Make sure this matches the 'users' table name
          key: 'id'
        }
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

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('companies');
  }
};
