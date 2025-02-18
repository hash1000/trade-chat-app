'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add the column first
    await queryInterface.addColumn('address', 'adminId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // Step 2: Add foreign key constraint for adminId
    await queryInterface.addConstraint('address', {
      fields: ['adminId'],
      type: 'foreign key',
      name: 'fk_address_adminId',
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
    await queryInterface.removeConstraint('address', 'fk_address_adminId');

    // Step 2: Remove the column
    await queryInterface.removeColumn('address', 'adminId');
  }
};
