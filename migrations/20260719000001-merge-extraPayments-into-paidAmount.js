"use strict";

// Data reconciliation: historically, buyer top-ups and admin-recorded top-ups were
// written to `extraPayments`, a separate bucket from `paidAmount`. balanceDue is now
// computed as (total − paidAmount), so any amount stranded in extraPayments would make
// already-settled orders look unpaid. This folds extraPayments into paidAmount and
// zeroes extraPayments so existing orders reconcile with the new formula.
//
// Applies to both `orders` and `service_orders`. Idempotent-safe: running it twice is
// harmless because extraPayments is set to 0 after the first pass.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE orders SET paidAmount = paidAmount + extraPayments, extraPayments = 0 WHERE extraPayments <> 0"
    );
    await queryInterface.sequelize.query(
      "UPDATE service_orders SET paidAmount = paidAmount + extraPayments, extraPayments = 0 WHERE extraPayments <> 0"
    );
  },

  // Irreversible by design: once merged, the original split between paidAmount and
  // extraPayments cannot be recovered. No-op down so the migration can be marked
  // reverted without corrupting data.
  async down() {
    /* no-op — merge cannot be safely un-merged */
  },
};
