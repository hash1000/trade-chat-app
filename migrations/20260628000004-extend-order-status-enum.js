"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED','draft','confirmed','cancelled') NOT NULL DEFAULT 'WAITING'`
    );
  },

  async down(queryInterface, Sequelize) {
    // Revert new statuses to WAITING before removing them
    await queryInterface.sequelize.query(
      `UPDATE orders SET status = 'WAITING' WHERE status IN ('draft','confirmed','cancelled')`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED') NOT NULL DEFAULT 'WAITING'`
    );
  },
};
