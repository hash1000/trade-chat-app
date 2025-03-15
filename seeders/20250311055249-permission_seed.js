module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert("permissions", [
      {
        roleId: 1, // Admin
        resource: "orders",
        create: true,
        readAll: true,  // Admins can read all orders
        readSingle: true,
        canUpdate: true,
        canDelete: true
      },
      {
        roleId: 2, // Operator
        resource: "orders",
        create: true,
        readAll: true,  // Operators can read all operators' orders
        readSingle: true,
        canUpdate: true,
        canDelete: true
      },
      {
        roleId: 3, // User
        resource: "orders",
        create: false,
        readAll: true,
        readSingle: true,
        canUpdate: false,
        canDelete: false,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete("permissions", null, {});
  },
};