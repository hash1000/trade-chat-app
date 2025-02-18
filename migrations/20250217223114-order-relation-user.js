'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the column first
    await queryInterface.addColumn('users', 'orderId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Step 2: Add foreign key constraint (this ensures uniqueness)
    await queryInterface.addConstraint('users', {
      fields: ['orderId'],
      type: 'foreign key',
      name: 'fk_users_orderId',
      references: {
        table: 'orders',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Step 1: Remove the foreign key constraint
    await queryInterface.removeConstraint('users', 'fk_users_orderId');

    // Step 2: Remove the column
    await queryInterface.removeColumn('users', 'orderId');
  }
};
