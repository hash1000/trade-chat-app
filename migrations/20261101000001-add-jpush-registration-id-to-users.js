"use strict";

// JPush replaces FCM for push (FCM is blocked in mainland China). The app
// reports its JPush registration id via POST /auth/update-fcm; NotificationService
// pushes through JPush when it's set and falls back to `fcm` otherwise.
// Indexed because registering an id clears it from any other account that
// last used the same device. Skips when the column already exists.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("users");
    if (table.jpushRegistrationId) return;
    await queryInterface.addColumn("users", "jpushRegistrationId", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "fcm",
    });
    await queryInterface.addIndex("users", ["jpushRegistrationId"], {
      name: "users_jpush_registration_id",
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("users");
    if (!table.jpushRegistrationId) return;
    await queryInterface.removeIndex("users", "users_jpush_registration_id");
    await queryInterface.removeColumn("users", "jpushRegistrationId");
  },
};
