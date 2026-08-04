"use strict";

const SHADOW_KEYS = ["email_verified", "phoneNumber_verified", "password"];

module.exports = {
  up: async (queryInterface) => {
    const [users] = await queryInterface.sequelize.query(
      "SELECT id, settings FROM users WHERE settings IS NOT NULL",
    );

    for (const user of users) {
      let settings = user.settings;

      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        } catch (error) {
          continue;
        }
      }

      if (!settings || typeof settings !== "object") {
        continue;
      }

      const hasShadowKey = SHADOW_KEYS.some((key) =>
        Object.prototype.hasOwnProperty.call(settings, key),
      );

      if (!hasShadowKey) {
        continue;
      }

      const cleanedSettings = { ...settings };
      SHADOW_KEYS.forEach((key) => delete cleanedSettings[key]);

      await queryInterface.sequelize.query(
        "UPDATE users SET settings = ? WHERE id = ?",
        {
          replacements: [JSON.stringify(cleanedSettings), user.id],
        },
      );
    }
  },

  down: async () => {
    // Irreversible data cleanup: the removed shadow fields (email_verified,
    // phoneNumber_verified, password) are not recoverable.
  },
};
