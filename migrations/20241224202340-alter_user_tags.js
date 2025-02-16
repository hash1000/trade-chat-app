'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {

    // Add a unique constraint to the 'userId' column
    await queryInterface.changeColumn('userTags', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      unique: true, // Enforce one-to-one relationship
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {

    // Remove the unique constraint from 'userId'
    await queryInterface.changeColumn('userTags', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    });
  },
};
