module.exports = {
  up: async (queryInterface, Sequelize) => {
    const timestamp = new Date();

    // Insert accountant role if it doesn't already exist
    await queryInterface.bulkInsert(
      "Roles",
      [
        {
          name: "accountant",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      {}
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete(
      "Roles",
      { name: "accountant" },
      {}
    );
  },
};
