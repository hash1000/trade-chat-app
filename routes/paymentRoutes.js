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

router.post(
  "/adjust-rate",
  authMiddleware,
  authorize(["admin"]),
  currencyAdjustmentValidator,
  paymentController.priceAdjust
);

// Public endpoint to get current rate
router.get("/current-rate", paymentController.getCurrentRate);

router.post(
  "/topup/initiate",
  authMiddleware,
  createTopupValidator,
  paymentController.initiateTopup
);

router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  paymentController.handleStripeWebhook.bind(paymentController)
);

module.exports = router;
