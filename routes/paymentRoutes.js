const express = require("express");
const bodyParser = require("body-parser"); // ✅ ADD THIS
const router = express.Router();

const PaymentController = require("../controllers/PaymentController");
const authMiddleware = require("../middlewares/authenticate");
const {
  createPaymentValidator,
  updatePaymentValidator,
  createTopupValidator,
  currencyAdjustmentValidator,
  validatePaymentType,
  createBalanceSheetValidator,
  addLedgerValidator,
  addIncomeValidator,
  addExpenseValidator,
  bulkLedgerTransactionValidator,
  bulkLedgerCreateValidator,
  validateUpdatePaymentType,
} = require("../middlewares/paymentValidation");
const authorize = require("../middlewares/authorization");

const paymentController = new PaymentController();

router.post(
  "/",
  authMiddleware,
  createPaymentValidator,
  paymentController.createPayment.bind(paymentController),
);
router.put(
  "/:id",
  authMiddleware,
  updatePaymentValidator,
  paymentController.updatePayment.bind(paymentController),
);
router.post(
  "/:id/confirm",
  authMiddleware,
  paymentController.confirmPayment.bind(paymentController),
);
router.delete(
  "/:id",
  authMiddleware,
  paymentController.deletePayment.bind(paymentController),
);
router.get(
  "/",
  authMiddleware,
  paymentController.getUserPayments.bind(paymentController),
);
router.get(
  "/cards",
  authMiddleware,
  paymentController.getUserCards.bind(paymentController),
);
router.post(
  "/cards",
  authMiddleware,
  paymentController.addUserCard.bind(paymentController),
);
router.delete(
  "/cards/:id",
  authMiddleware,
  paymentController.deleteUserCard.bind(paymentController),
);
router.put(
  "/favourite/:id",
  authMiddleware,
  paymentController.favouritePayment.bind(paymentController),
);
router.put(
  "/unfavourite/:id",
  authMiddleware,
  paymentController.unfavouritePayment.bind(paymentController),
);

//  stripe
router.post(
  "/adjust-rate",
  authMiddleware,
  authorize(["admin"]),
  currencyAdjustmentValidator,
  paymentController.priceAdjust.bind(paymentController),
);

// Public endpoint to get current rate
router.get(
  "/current-rate",
  paymentController.getCurrentRate.bind(paymentController),
);

router.post(
  "/topup/initiate",
  authMiddleware,
  createTopupValidator,
  paymentController.initiateTopup.bind(paymentController),
);

router.get(
  "/topup/transactions",
  authMiddleware,
  paymentController.getUserTopupTransactions.bind(paymentController),
);

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  paymentController.handleStripeWebhook.bind(paymentController),
);

// ------------------ LEDGER ------------------

// Bulk create ledgers with nested incomes/expenses
router.post(
  "/bulk-ledgers",
  authMiddleware,
  bulkLedgerCreateValidator,
  paymentController.bulkCreateLedgers.bind(paymentController),
);

// Create single ledger (no nested incomes/expenses)
router.post(
  "/ledgers",
  authMiddleware,
  addLedgerValidator,
  paymentController.addLedger.bind(paymentController),
);

// Add incomes/expenses to existing ledger
router.post(
  "/ledgers/:id/income-expense",
  authMiddleware,
  bulkLedgerTransactionValidator,
  paymentController.addBulkLedgerTransactions.bind(paymentController),
);

// Get all ledgers for logged-in user
router.get(
  "/ledgers",
  authMiddleware,
  paymentController.getUserLedgers.bind(paymentController),
);

// Get ledger by ID
router.get(
  "/ledgers/:id",
  authMiddleware,
  paymentController.getLedgerById.bind(paymentController),
);

// Sequence ledger by ID

router.put(
  "/ledgers/:id/reorder",
  authMiddleware,
  paymentController.reorderLedger.bind(paymentController),
);

// Update ledger by ID
router.put(
  "/ledgers/:id",
  authMiddleware,
  addLedgerValidator,
  paymentController.updateLedger.bind(paymentController),
);

// Delete ledger by ID
router.delete(
  "/ledgers/:id",
  authMiddleware,
  paymentController.deleteLedger.bind(paymentController),
);

router.post(
  "/ledgers/:id/duplicate",
  authMiddleware,
  paymentController.duplicateLedger.bind(paymentController),
);

router.patch(
  "/ledgers/:id/archive",
  authMiddleware,
  paymentController.archiveLedger.bind(paymentController),
);

// ------------------ INCOME ------------------

// Create income for a ledger
router.post(
  "/incomes",
  authMiddleware,
  addIncomeValidator,
  paymentController.addIncomeQRM.bind(paymentController),
);

// Get income by ID
router.get(
  "/incomes/:id",
  authMiddleware,
  paymentController.getIncomeById.bind(paymentController),
);

// Update income
router.put(
  "/incomes/:id",
  authMiddleware,
  addIncomeValidator,
  paymentController.updateIncome.bind(paymentController),
);

// Delete income
router.delete(
  "/incomes/:id",
  authMiddleware,
  paymentController.deleteIncome.bind(paymentController),
);

// ------------------ EXPENSE ------------------

// Create expense for a ledger
router.post(
  "/expenses",
  authMiddleware,
  addExpenseValidator,
  paymentController.addExpenseQRM.bind(paymentController),
);

// Get expense by ID
router.get(
  "/expenses/:id",
  authMiddleware,
  paymentController.getExpenseById.bind(paymentController),
);

// Update expense
router.put(
  "/expenses/:id",
  authMiddleware,
  addExpenseValidator,
  paymentController.updateExpense.bind(paymentController),
);

// Delete expense
router.delete(
  "/expenses/:id",
  authMiddleware,
  paymentController.deleteExpense.bind(paymentController),
);

// ------------------ PAYMENT TYPE ------------------

router.post(
  "/paymentTypes",
  authMiddleware,
  validatePaymentType,
  paymentController.createPaymentType.bind(paymentController),
);

router.get(
  "/paymentTypes",
  authMiddleware,
  paymentController.getAllPaymentTypes.bind(paymentController),
);

router.get(
  "/paymentTypes/:id",
  authMiddleware,
  paymentController.getPaymentType.bind(paymentController),
);

router.put(
  "/paymentTypes/:id",
  authMiddleware,
  validateUpdatePaymentType,
  paymentController.updatePaymentType.bind(paymentController),
);

router.delete(
  "/paymentTypes/:id",
  authMiddleware,
  paymentController.deletePaymentType.bind(paymentController),
);

module.exports = router;
