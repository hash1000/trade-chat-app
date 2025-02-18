'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the column first
    await queryInterface.addColumn('orders', 'addressId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Step 2: Add foreign key constraint (this ensures uniqueness)
    await queryInterface.addConstraint('orders', {
      fields: ['addressId'],
      type: 'foreign key',
      name: 'fk_address_addressId',
      references: {
        table: 'address', // Correct table reference
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    
  },

  down: async (queryInterface, Sequelize) => {
    // Step 1: Remove the foreign key constraint
    await queryInterface.removeConstraint('orders', 'fk_address_addressId');

    // Step 2: Remove the column
    await queryInterface.removeColumn('orders', 'addressId')
  }
};
