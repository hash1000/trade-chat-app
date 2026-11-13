"use strict";

// Step 0: one-time codes are stored only as a hash, with try and send limits.
//   otp      + code_hash, attempts, send_count, send_window_start
//   EmailOtp + contact, attempts
// Every plain code already in the database is wiped (otp.otp, EmailOtp.otp,
// users.otp). Anyone in the middle of a code check just asks for a new code.
// Skips columns that already exist, so it is safe to run twice.
module.exports = {
  async up(queryInterface, Sequelize) {
    const otp = await queryInterface.describeTable("otp");
    if (!otp.code_hash) {
      await queryInterface.addColumn("otp", "code_hash", { type: Sequelize.STRING(64), allowNull: true });
    }
    if (!otp.attempts) {
      await queryInterface.addColumn("otp", "attempts", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    }
    if (!otp.send_count) {
      await queryInterface.addColumn("otp", "send_count", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    }
    if (!otp.send_window_start) {
      await queryInterface.addColumn("otp", "send_window_start", { type: Sequelize.DATE, allowNull: true });
    }

    const emailOtp = await queryInterface.describeTable("EmailOtp");
    if (!emailOtp.contact) {
      await queryInterface.addColumn("EmailOtp", "contact", { type: Sequelize.STRING(255), allowNull: true });
      await queryInterface.addIndex("EmailOtp", ["contact", "created_at"], { name: "email_otp_contact_created_at" });
    }
    if (!emailOtp.attempts) {
      await queryInterface.addColumn("EmailOtp", "attempts", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    }

    // Wipe every plain-text code.
    await queryInterface.sequelize.query("UPDATE `otp` SET `otp` = NULL, `code_hash` = NULL");
    await queryInterface.sequelize.query("UPDATE `EmailOtp` SET `otp` = '', `verified` = 1");
    await queryInterface.sequelize.query("UPDATE `users` SET `otp` = NULL WHERE `otp` IS NOT NULL");
  },

  async down(queryInterface) {
    // The wiped codes can't come back; that's fine, they were short-lived.
    const otp = await queryInterface.describeTable("otp");
    for (const col of ["code_hash", "attempts", "send_count", "send_window_start"]) {
      if (otp[col]) await queryInterface.removeColumn("otp", col);
    }
    const emailOtp = await queryInterface.describeTable("EmailOtp");
    if (emailOtp.contact) {
      await queryInterface.removeIndex("EmailOtp", "email_otp_contact_created_at").catch(() => {});
      await queryInterface.removeColumn("EmailOtp", "contact");
    }
    if (emailOtp.attempts) await queryInterface.removeColumn("EmailOtp", "attempts");
  },
};
