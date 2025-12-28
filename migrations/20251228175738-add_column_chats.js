module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("chats", "rating", {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("chats", "rating");
  },
};
