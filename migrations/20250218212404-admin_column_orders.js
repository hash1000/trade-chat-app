'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the column first
    await queryInterface.addColumn('orders', 'adminId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Step 2: Add foreign key constraint for adminId
    await queryInterface.addConstraint('orders', {
      fields: ['adminId'],
      type: 'foreign key',
      name: 'fk_orders_adminId',
      references: {
        table: 'users', // Admin is also a user
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Step 1: Remove the foreign key constraint
    await queryInterface.removeConstraint('orders', 'fk_orders_adminId');

    // Step 2: Remove the column
    await queryInterface.removeColumn('orders', 'adminId');
  }
};
