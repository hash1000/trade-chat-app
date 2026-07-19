"use strict";

// Data reconciliation: orders.paidAmount had drifted out of sync with reality (e.g.
// double-counted values from an earlier extraPayments merge / repeated confirms),
// which made order-level totals and the payFullBalance top-up compute wrong balances.
//
// The reliable source of truth is the per-item service_orders.paidAmount (each item's
// paidAmount correctly equals finalAmount + paid add-ons). This recomputes each order's
// paidAmount as the sum of its service_orders' paidAmount, and also resets
// orders.extraPayments to the sum of the items' extraPayments so the columns line up.
//
// Idempotent: re-running it just recomputes the same sums.
module.exports = {
  async up(queryInterface) {
    // orders.paidAmount = Σ service_orders.paidAmount (0 when an order has no items)
    await queryInterface.sequelize.query(`
      UPDATE orders o
      LEFT JOIN (
        SELECT orderId,
               SUM(paidAmount) AS sumPaid,
               SUM(extraPayments) AS sumExtra
        FROM service_orders
        GROUP BY orderId
      ) s ON s.orderId = o.id
      SET o.paidAmount = COALESCE(s.sumPaid, 0),
          o.extraPayments = COALESCE(s.sumExtra, 0)
    `);
  },

  // Irreversible: the pre-reconciliation (incorrect) values are not recoverable.
  async down() {
    /* no-op */
  },
};
