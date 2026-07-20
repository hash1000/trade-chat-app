"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("shopProducts", "soldQuantity", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("shopProducts", "status", {
      type: Sequelize.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    });

    await queryInterface.addColumn("productVariations", "soldQuantity", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("productVariations", "soldQuantity");
    await queryInterface.removeColumn("shopProducts", "status");
    await queryInterface.removeColumn("shopProducts", "soldQuantity");
  },
};
