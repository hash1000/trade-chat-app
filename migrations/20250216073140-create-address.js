'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('address', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      companyName: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      firstName: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      middleName: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      lastName: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      contactPerson: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      country: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      city: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      postalCode: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      street: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      streetNumber: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      vatNumber: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      customerNumber: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      deliveryNote: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'users', // Ensure this matches your User table name
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('company', 'delivery'),
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('address');
  },
};
