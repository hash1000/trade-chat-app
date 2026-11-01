"use strict";

// Message templates (saved text snippets a user picks from in chat). They
// used to live in the Firestore "templates" collection; scripts/syncFirebaseTemplates.js
// brings them over with legacyId = the Firestore doc id. Paranoid (deletedAt)
// so a template deleted in this app isn't re-created by the next sync run.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("templates", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      title: {
        allowNull: false,
        type: Sequelize.STRING(255),
      },
      subTitle: {
        allowNull: true,
        type: Sequelize.TEXT,
      },
      sequence: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      legacyId: {
        allowNull: true,
        type: Sequelize.STRING(64),
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
      deletedAt: { allowNull: true, type: Sequelize.DATE },
    });
    await queryInterface.addIndex("templates", ["userId", "sequence"], {
      name: "templates_user_sequence",
    });
    await queryInterface.addIndex("templates", ["legacyId"], {
      unique: true,
      name: "templates_legacy_id_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("templates");
  },
};
