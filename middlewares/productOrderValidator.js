const { body, param, query, validationResult } = require("express-validator");

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

const STATUS_VALUES = [
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "customs",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
  "returned",
];

exports.checkoutValidation = [
  body("walletId")
    .notEmpty()
    .withMessage("walletId is required")
    .isInt()
    .withMessage("walletId must be an integer"),

  body("addressId")
    .optional({ nullable: true })
    .isInt()
    .withMessage("addressId must be an integer"),

  body("deliveryType")
    .optional({ nullable: true })
    .isString()
    .withMessage("deliveryType must be a string"),

  body("note")
    .optional({ nullable: true })
    .isString()
    .withMessage("note must be a string"),

  handleValidationErrors,
];

exports.paginationValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be an integer >= 1"),
  query("limit").optional().isInt({ min: 1 }).withMessage("limit must be an integer >= 1"),
  handleValidationErrors,
];

exports.shopOrdersListValidation = [
  param("shopId").isInt().withMessage("shopId must be an integer"),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be an integer >= 1"),
  query("limit").optional().isInt({ min: 1 }).withMessage("limit must be an integer >= 1"),
  query("status").optional().isIn(STATUS_VALUES).withMessage(`status must be one of: ${STATUS_VALUES.join(", ")}`),
  handleValidationErrors,
];

exports.myShopOrdersListValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be an integer >= 1"),
  query("limit").optional().isInt({ min: 1 }).withMessage("limit must be an integer >= 1"),
  query("status").optional().isIn(STATUS_VALUES).withMessage(`status must be one of: ${STATUS_VALUES.join(", ")}`),
  handleValidationErrors,
];

exports.updateStatusValidation = [
  param("shopOrderId").isInt().withMessage("shopOrderId must be an integer"),
  body("status")
    .notEmpty()
    .withMessage("status is required")
    .isIn(STATUS_VALUES)
    .withMessage(`status must be one of: ${STATUS_VALUES.join(", ")}`),
  handleValidationErrors,
];

// Either addOnId (charge for a catalog add-on — name/amount pulled from it
// server-side) OR name+amount (freeform charge, e.g. shipping) must be given.
exports.addChargeValidation = [
  param("shopOrderId").isInt().withMessage("shopOrderId must be an integer"),

  body("addOnId")
    .optional({ nullable: true })
    .isInt()
    .withMessage("addOnId must be an integer"),

  body("name")
    .if((value, { req }) => !req.body.addOnId)
    .notEmpty()
    .withMessage("name is required when addOnId is not given")
    .isString(),

  body("description").optional({ nullable: true }).isString(),

  body("amount")
    .if((value, { req }) => !req.body.addOnId)
    .notEmpty()
    .withMessage("amount is required when addOnId is not given")
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),

  handleValidationErrors,
];

exports.payChargeValidation = [
  param("chargeId").isInt().withMessage("chargeId must be an integer"),
  body("walletId").notEmpty().withMessage("walletId is required").isInt().withMessage("walletId must be an integer"),
  handleValidationErrors,
];

// Buyer pays down the shop-order's outstanding balance directly (not tied to a
// specific charge). amount is required unless payFullBalance is true.
exports.topUpShopOrderValidation = [
  param("shopOrderId").isInt().withMessage("shopOrderId must be an integer"),
  body("payFullBalance")
    .optional()
    .isBoolean()
    .withMessage("payFullBalance must be a boolean"),
  body("amount")
    .if((value, { req }) => req.body.payFullBalance !== true)
    .notEmpty()
    .withMessage("amount is required")
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),
  body("walletId").notEmpty().withMessage("walletId is required").isInt().withMessage("walletId must be an integer"),
  handleValidationErrors,
];

// Admin/accountant records a payment received outside the platform (cash, bank
// transfer, etc.) — no buyer wallet is touched, only the shop-order ledger and
// the shop's payout wallet are credited.
exports.adminRecordShopOrderPaymentValidation = [
  param("shopOrderId").isInt().withMessage("shopOrderId must be an integer"),
  body("amount")
    .notEmpty()
    .withMessage("amount is required")
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),
  body("note")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("note must be a string up to 1000 characters"),
  handleValidationErrors,
];
