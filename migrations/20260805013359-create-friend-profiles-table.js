'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('friend_profiles', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      profileId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      userName: {
        allowNull: true,
        type: Sequelize.STRING
      },
      profilePic: {
        allowNull: true,
        type: Sequelize.STRING
      },
      description: {
        allowNull: true,
        type: Sequelize.TEXT
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

    await queryInterface.addIndex('friend_profiles', ['userId', 'profileId'], {
      unique: true,
      name: 'friend_profiles_user_profile_unique'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('friend_profiles');
  }
};
