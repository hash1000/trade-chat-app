"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED','DRAFT','PENDING_PAYMENT','CONFIRMED','CANCELLED','PENDING') NOT NULL DEFAULT 'WAITING'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED','PENDING_PAYMENT') NOT NULL DEFAULT 'WAITING'`
    );
  },
};
