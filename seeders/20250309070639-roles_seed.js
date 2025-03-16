module.exports = {
  up: async (queryInterface, Sequelize) => {
    const timestamp = new Date(); // Get current timestamp

    await queryInterface.bulkInsert("Roles", [
      {
        name: "admin",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        name: "operator",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        name: "user",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Roles", null, {});
  },
};
