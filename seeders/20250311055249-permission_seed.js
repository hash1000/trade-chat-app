module.exports = {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert("permissions", [
      {
        roleId: 1, // Admin
        resource: "orders",
        create: true,
        readAll: true,  // ✅ Admins see all data
        readSingle: true,
        canUpdate: true,
        canDelete: true,
        ownData: true,
        allData: true,  // ✅ Admins see all orders
      },
      {
        roleId: 2, // Operator
        resource: "orders",
        create: true,
        readAll: true,  // ✅ Operators see all operators' orders
        readSingle: true,
        canUpdate: true,
        canDelete: true,
        ownData: true,
        allData: false, // ❌ Operators should not see user orders
      },
      {
        roleId: 3, // User
        resource: "orders",
        create: false,
        readAll: false, // ❌ Users cannot see other users' orders
        readSingle: true,
        canUpdate: false,
        canDelete: false,
        ownData: true,  // ✅ Users see only their own orders
        allData: false,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete("permissions", null, {});
  },
};
