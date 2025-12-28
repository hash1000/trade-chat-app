module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "rating", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "rating");
  },
};
