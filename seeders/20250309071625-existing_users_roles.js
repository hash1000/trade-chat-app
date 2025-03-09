'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Get the 'user' role ID
    const [role] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE name = 'user' LIMIT 1;`
    );

    if (role.length === 0) {
      console.error("Role 'user' not found.");
      return;
    }

    const roleId = role[0].id;

    // Get all user IDs
    const [users] = await queryInterface.sequelize.query(
      `SELECT id FROM users;`
    );

    if (users.length === 0) {
      console.error("No users found.");
      return;
    }

    // Prepare user-role mappings
    const userRoles = users.map(user => ({
      userId: user.id,
      roleId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    // Insert into User_Roles table
    await queryInterface.bulkInsert('User_Roles', userRoles);
  },

  async down(queryInterface, Sequelize) {
    // Remove assigned roles
    await queryInterface.sequelize.query(
      `DELETE FROM "User_Roles" WHERE "roleId" = (SELECT id FROM roles WHERE name = 'user');`
    );
  }
};
