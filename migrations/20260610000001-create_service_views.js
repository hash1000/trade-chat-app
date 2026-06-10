"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("service_views", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("service_views", ["userId", "serviceId"], {
      unique: true,
      name: "service_views_user_id_service_id_unique",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      "service_views",
      "service_views_user_id_service_id_unique"
    );
    await queryInterface.dropTable("service_views");
  },
};
