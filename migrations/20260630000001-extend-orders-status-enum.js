"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED','DRAFT','PENDING','CONFIRMED','CANCELLED','PENDING') NOT NULL DEFAULT 'WAITING'`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED','PENDING') NOT NULL DEFAULT 'WAITING'`
    );
  },
};
