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

// Payment Type Routes
router.post(
  "/paymentType",
  authMiddleware,
  validatePaymentType,
  paymentController.createPaymentType.bind(paymentController)
);
router.get(
  "/paymentType",
  authMiddleware,
  paymentController.getAllPaymentTypes.bind(paymentController)
);
router.get(
  "/paymentType/:id",
  authMiddleware,
  paymentController.getPaymentType.bind(paymentController)
);
router.put(
  "/paymentType/:id",
  authMiddleware,
  validatePaymentType,
  paymentController.updatePaymentType.bind(paymentController)
);
router.delete(
  "/paymentType/:id",
  authMiddleware,
  paymentController.deletePaymentType.bind(paymentController)
);
module.exports = router;
