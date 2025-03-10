module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert("permissions", [
      {
        roleId: 1, // Admin
        resource: "orders",
        canCreate: true,
        canReadAll: true,
        canSingleRead: true,
        canUpdate: true,
        canDelete: true,
      },
      {
        roleId: 2, // Operator
        resource: "orders",
        canCreate: true,
        canReadAll: true,
        canSingleRead: true,
        canUpdate: true,
        canDelete: true,
      },
      {
        roleId: 3, // User
        resource: "orders",
        canCreate: false,
        canReadAll: true,
        canSingleRead: true,
        canUpdate: false,
        canDelete: false,
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete("permissions", null, {});
  },
};
