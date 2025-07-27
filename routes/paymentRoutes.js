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
} = require("../middlewares/paymentValidation");
const authorize = require("../middlewares/authorization");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");

const paymentController = new PaymentController();

router.post(
  "/",
  authMiddleware,
  createPaymentValidator,
  paymentController.createPayment.bind(paymentController)
);
router.put(
  "/:id",
  authMiddleware,
  updatePaymentValidator,
  paymentController.updatePayment.bind(paymentController)
);
router.post(
  "/:id/confirm",
  authMiddleware,
  paymentController.confirmPayment.bind(paymentController)
);
router.delete(
  "/:id",
  authMiddleware,
  paymentController.deletePayment.bind(paymentController)
);
router.get(
  "/",
  authMiddleware,
  paymentController.getUserPayments.bind(paymentController)
);
router.get(
  "/cards",
  authMiddleware,
  paymentController.getUserCards.bind(paymentController)
);
router.post(
  "/cards",
  authMiddleware,
  paymentController.addUserCard.bind(paymentController)
);
router.delete(
  "/cards/:id",
  authMiddleware,
  paymentController.deleteUserCard.bind(paymentController)
);
router.put(
  "/favourite/:id",
  authMiddleware,
  paymentController.favouritePayment.bind(paymentController)
);
router.put(
  "/unfavourite/:id",
  authMiddleware,
  paymentController.unfavouritePayment.bind(paymentController)
);

//  stripe
router.post(
  "/adjust-rate",
  authMiddleware,
  authorize(["admin"]),
  currencyAdjustmentValidator,
  paymentController.priceAdjust.bind(paymentController)
);

// Public endpoint to get current rate
router.get(
  "/current-rate",
  paymentController.getCurrentRate.bind(paymentController)
);

router.post(
  "/topup/initiate",
  authMiddleware,
  createTopupValidator,
  paymentController.initiateTopup.bind(paymentController)
);

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  paymentController.handleStripeWebhook.bind(paymentController)
);


// BALANCE SHEET
router.post("/balance-sheet", authMiddleware, createBalanceSheetValidator, paymentController.createBalanceSheet.bind(paymentController));
router.get("/balance-sheets", authMiddleware, paymentController.getBalanceSheets.bind(paymentController));
router.get("/balance-sheet/:id", authMiddleware, paymentController.getBalanceSheetById.bind(paymentController));
router.put("/balance-sheet/:id", authMiddleware, paymentController.updateBalanceSheet.bind(paymentController));
router.delete("/balance-sheet/:id", authMiddleware, paymentController.deleteBalanceSheet.bind(paymentController));

// LEDGER
router.post("/add-ledger", authMiddleware, addLedgerValidator, paymentController.addLedger.bind(paymentController));
router.get("/ledger/:id", authMiddleware, paymentController.getLedgerById.bind(paymentController));
router.put("/ledger/:id", authMiddleware, paymentController.updateLedger.bind(paymentController));
router.delete("/ledger/:id", authMiddleware, paymentController.deleteLedger.bind(paymentController));

// INCOME
router.post("/add-income-qrm", authMiddleware, addIncomeValidator, paymentController.addIncomeQRM.bind(paymentController));
router.get("/income/:id", authMiddleware, paymentController.getIncomeById.bind(paymentController));
router.put("/income/:id", authMiddleware, addIncomeValidator, paymentController.updateIncome.bind(paymentController));
router.delete("/income/:id", authMiddleware, paymentController.deleteIncome.bind(paymentController));

// EXPENSE
router.post("/add-expense-qrm", authMiddleware, addExpenseValidator, paymentController.addExpenseQRM.bind(paymentController));
router.get("/expense/:id", authMiddleware, paymentController.getExpenseById.bind(paymentController));
router.put("/expense/:id", authMiddleware, addExpenseValidator, paymentController.updateExpense.bind(paymentController));
router.delete("/expense/:id", authMiddleware, paymentController.deleteExpense.bind(paymentController));

// PAYMENT TYPE
router.post("/paymentType", authMiddleware, validatePaymentType, paymentController.createPaymentType.bind(paymentController));
router.get("/paymentType", authMiddleware, paymentController.getAllPaymentTypes.bind(paymentController));
router.get("/paymentType/:id", authMiddleware, paymentController.getPaymentType.bind(paymentController));
router.put("/paymentType/:id", authMiddleware, validatePaymentType, paymentController.updatePaymentType.bind(paymentController));
router.delete("/paymentType/:id", authMiddleware, paymentController.deletePaymentType.bind(paymentController));

module.exports = router;
