const { body, param, validationResult } = require("express-validator");

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
}

exports.addToCartValidation = [
  body("shopProductId")
    .notEmpty()
    .withMessage("shopProductId is required")
    .isInt()
    .withMessage("shopProductId must be an integer"),

  body("variationId")
    .optional({ nullable: true })
    .isInt()
    .withMessage("variationId must be an integer"),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("quantity must be an integer >= 1"),

  body("code")
    .optional({ nullable: true })
    .isString()
    .withMessage("code must be a string"),

  handleValidationErrors,
];

exports.updateQuantityValidation = [
  param("cartItemId").isInt().withMessage("cartItemId must be an integer"),

  body("quantity")
    .notEmpty()
    .withMessage("quantity is required")
    .isInt({ min: 0 })
    .withMessage("quantity must be an integer >= 0"),

  handleValidationErrors,
];

exports.applyDiscountValidation = [
  param("cartItemId").isInt().withMessage("cartItemId must be an integer"),

  body("code")
    .notEmpty()
    .withMessage("code is required")
    .isString()
    .withMessage("code must be a string"),

  handleValidationErrors,
];

exports.removeItemsValidation = [
  body("cartItemIds")
    .isArray({ min: 1 })
    .withMessage("cartItemIds must be a non-empty array"),

  body("cartItemIds.*")
    .isInt()
    .withMessage("cartItemIds must contain only integers"),

  handleValidationErrors,
];
