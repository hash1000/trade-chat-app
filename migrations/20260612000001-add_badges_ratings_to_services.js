"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("services", "isTopChoice", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("services", "isQRMVerified", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("services", "insured", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("services", "moneyBack", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("services", "support247", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn("services", "tags", {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: [],
    });

    await queryInterface.addColumn("services", "ratingAvg", {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("services", "ratingCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn("services", "purchaseCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("services", "isTopChoice");
    await queryInterface.removeColumn("services", "isQRMVerified");
    await queryInterface.removeColumn("services", "insured");
    await queryInterface.removeColumn("services", "moneyBack");
    await queryInterface.removeColumn("services", "support247");
    await queryInterface.removeColumn("services", "tags");
    await queryInterface.removeColumn("services", "ratingAvg");
    await queryInterface.removeColumn("services", "ratingCount");
    await queryInterface.removeColumn("services", "purchaseCount");
  },
};
