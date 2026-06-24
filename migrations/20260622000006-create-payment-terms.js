"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payment_terms", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "services", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      type: {
        type: Sequelize.ENUM("FULL_PREPAYMENT", "SPLIT", "QMLC"),
        allowNull: false,
        defaultValue: "FULL_PREPAYMENT",
      },

      icon: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      color: {
        type: Sequelize.STRING(7),
        allowNull: true,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      visibleToBuyers: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      whenCharged: {
        type: Sequelize.ENUM("AT_CHECKOUT"),
        allowNull: true,
      },

      depositPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      balancePercentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      balanceDueDate: {
        type: Sequelize.ENUM(
          "BEFORE_SHIPMENT",
          "AFTER_CARGO_LOADED",
          "ON_DELIVERY",
          "AFTER_INSPECTION"
        ),
        allowNull: true,
      },

      escrowPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 100,
      },

      releaseConditions: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      createdBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
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

    await queryInterface.addIndex("payment_terms", ["serviceId", "isDefault"]);
    await queryInterface.addIndex("payment_terms", ["serviceId", "isActive"]);
    await queryInterface.addIndex("payment_terms", ["serviceId", "visibleToBuyers"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("payment_terms");
  },
};
