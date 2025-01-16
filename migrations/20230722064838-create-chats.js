'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('chats', {
      id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER
      },
      user1Id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users', // Ensure this matches the table name
          key: 'id'
        },
        allowNull: false
      },
      user2Id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        },
        allowNull: false
      },
      userName: {
        type: Sequelize.STRING,
        allowNull: true
      },
      profilePic: {
        type: Sequelize.STRING,
        allowNull: true
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true
      },
      tags: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      lastReadUser1Id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      lastReadUser2Id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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
    await queryInterface.dropTable('chats');
  }
};
