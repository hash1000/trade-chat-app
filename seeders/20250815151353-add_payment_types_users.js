"use strict";

const { PaymentTypes } = require("../constants");

module.exports = {
  async up(queryInterface, Sequelize) {
    const [users] = await queryInterface.sequelize.query(`
      SELECT id FROM users
    `);
console.log("users", users);
    for (const user of users) {
      // Check if user already has payment types
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM payment_types WHERE userId = :userId`,
        { replacements: { userId: user.id } }
      );

      if (existing.length === 0) {
        const now = new Date();

        const records = PaymentTypes.map((type) => ({
          name: type,
          userId: user.id
        }));

        await queryInterface.bulkInsert("payment_types", records);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("payment_types", null, {});
  },
};
