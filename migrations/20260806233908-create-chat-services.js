"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("chat_services", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      chatId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "chats",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      serviceId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "services",
          key: "id",
        },
      },
      teamId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "teams",
          key: "id",
        },
      },
      // Status of this specific request against this specific service,
      // not the service listing's own status.
      status: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      // What the customer typed when requesting — a point-in-time
      // snapshot, kept separate from the Service listing itself.
      requestSubject: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      requestDesc: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isPaid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex("chat_services", ["chatId"]);
    await queryInterface.addIndex("chat_services", ["serviceId"]);
    await queryInterface.addIndex("chat_services", ["chatId", "serviceId"], {
      unique: true,
      name: "chat_services_chat_service_unique",
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable("chat_services");
  },
};
