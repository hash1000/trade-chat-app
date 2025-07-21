const { body, validationResult } = require("express-validator");

exports.createPaymentValidator = [
  body("amount").isFloat().notEmpty(),
  body("senderName").notEmpty(),
  body("orderNumber").notEmpty(),
  body("accountNumber").notEmpty(),
  body("accountType")
    .isIn(["personal", "company"])
    .notEmpty()
    .withMessage("accountType must be personal or company"),
  body("image").notEmpty(),
  handleValidationErrors,
];

exports.updatePaymentValidator = [
  body("amount").isFloat().notEmpty(),
  body("senderName").notEmpty(),
  body("orderNumber").notEmpty(),
  body("accountNumber").notEmpty(),
  handleValidationErrors,
];
exports.createTopupValidator = [
  // Basic topup validation
  body("amount")
    .isFloat({ min: 1 })
    .withMessage("Amount must be a number greater than 0")
    .notEmpty()
    .withMessage("Amount is required"),

  handleValidationErrors,
];

exports.validatePaymentType = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 50 })
    .withMessage("Name must be less than 50 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  handleValidationErrors,
];

exports.currencyAdjustmentValidator = [
  body("adjustment")
    .exists()
    .withMessage("Adjustment value is required")
    .isFloat()
    .withMessage("Adjustment must be a number")
    .custom((value) => {
      if (Math.abs(value) > 10) {
        throw new Error("Adjustment cannot be more than ±10");
      }
      return true;
    }),

  body("currency")
    .optional()
    .isString()
    .withMessage("Currency must be a string")
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be 3 characters")
    .isUppercase()
    .withMessage("Currency must be uppercase"),

  handleValidationErrors,
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
