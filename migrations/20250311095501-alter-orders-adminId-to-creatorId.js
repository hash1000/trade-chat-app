module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("orders", "adminId", "creatorId");

    await queryInterface.addColumn("orders", "creatorRole", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "admin", // Set default value for existing data
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.renameColumn("orders", "creatorId", "adminId");

    await queryInterface.removeColumn("orders", "creatorRole");
  },
};
