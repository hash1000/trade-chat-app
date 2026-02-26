'use strict';

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Keep the oldest row for each (userId, roleId) pair.
      await queryInterface.sequelize.query(
        `
          DELETE ur1
          FROM user_roles ur1
          INNER JOIN user_roles ur2
            ON ur1.userId = ur2.userId
           AND ur1.roleId = ur2.roleId
           AND ur1.id > ur2.id
        `,
        { transaction }
      );

      const [existingIndexes] = await queryInterface.sequelize.query(
        `
          SHOW INDEX
          FROM user_roles
          WHERE Key_name = 'user_roles_userId_roleId_unique'
        `,
        { transaction }
      );

      if (!existingIndexes.length) {
        await queryInterface.addIndex("user_roles", ["userId", "roleId"], {
          name: "user_roles_userId_roleId_unique",
          unique: true,
          transaction,
        });
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [existingIndexes] = await queryInterface.sequelize.query(
        `
          SHOW INDEX
          FROM user_roles
          WHERE Key_name = 'user_roles_userId_roleId_unique'
        `,
        { transaction }
      );

      if (existingIndexes.length) {
        await queryInterface.removeIndex(
          "user_roles",
          "user_roles_userId_roleId_unique",
          { transaction }
        );
      }
    });
  },
};
