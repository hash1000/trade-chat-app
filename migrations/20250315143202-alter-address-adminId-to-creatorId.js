module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("address", "adminId", "creatorId");
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("address", "creatorId", "adminId");
  },
};
