"use strict";

// Restores CONFIRMED (plus DRAFT / CANCELLED) to orders.status.
//
// 20260628000004 widened the enum to add draft/confirmed/cancelled, but
// 20260628000007 (same date prefix, runs right after) re-MODIFYed the column
// to ENUM('WAITING','PAYED','SHIPPED','PENDING') — silently dropping those
// three values while only meaning to add PENDING.
//
// The cart checkout (OrderCartService.checkoutCart) and confirmOrderPayment
// both write orders.status = "CONFIRMED", which MySQL in strict mode rejects
// with "Data truncated for column 'status' at row 1". That rolls back the
// checkout transaction and surfaces as PAYMENT_ERROR ("Checkout failed. No
// funds deducted. Please retry.").
//
// This aligns the column with models/order.js.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "ALTER TABLE orders MODIFY COLUMN status " +
        "ENUM('WAITING','PAYED','SHIPPED','DRAFT','PENDING','CONFIRMED','CANCELLED') " +
        "NOT NULL DEFAULT 'WAITING'"
    );
  },

  async down(queryInterface, Sequelize) {
    // Collapse values the narrowed enum can't represent before shrinking it.
    await queryInterface.sequelize.query(
      "UPDATE orders SET status = 'WAITING' WHERE status IN ('DRAFT','CONFIRMED','CANCELLED')"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE orders MODIFY COLUMN status " +
        "ENUM('WAITING','PAYED','SHIPPED','PENDING') NOT NULL DEFAULT 'WAITING'"
    );
  },
};
