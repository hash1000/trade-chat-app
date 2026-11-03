"use strict";

// The app version the user's device last reported (e.g. "1.4.2"), sent via
// PUT /auth/profile on launch so we can see who has updated the APK.
// Skips when the column already exists.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users");
    if (table.appVersion) return;
    await queryInterface.addColumn("users", "appVersion", {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: "jpushRegistrationId",
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("users");
    if (!table.appVersion) return;
    await queryInterface.removeColumn("users", "appVersion");
  },
};
