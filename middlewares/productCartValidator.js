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

  body("productCartItemQuantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("productCartItemQuantity must be an integer >= 1"),

  body("code")
    .optional({ nullable: true })
    .isString()
    .withMessage("code must be a string"),

  body("addOns")
    .optional({ nullable: true })
    .isArray()
    .withMessage("addOns must be an array"),

  body("addOns.*.addOnId")
    .isInt({ min: 1 })
    .withMessage("Each add-on must have a valid addOnId"),

  body("addOns.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each add-on quantity must be an integer >= 1"),

  handleValidationErrors,
];

exports.updateQuantityValidation = [
  param("cartItemId").isInt().withMessage("cartItemId must be an integer"),

  body("productCartItemQuantity")
    .notEmpty()
    .withMessage("productCartItemQuantity is required")
    .isInt({ min: 0 })
    .withMessage("productCartItemQuantity must be an integer >= 0"),

  body("addOns")
    .optional({ nullable: true })
    .isArray()
    .withMessage("addOns must be an array"),

  body("addOns.*.addOnId")
    .isInt({ min: 1 })
    .withMessage("Each add-on must have a valid addOnId"),

  body("addOns.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each add-on quantity must be an integer >= 1"),

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

exports.addAddOnsValidation = [
  param("cartItemId").isInt().withMessage("cartItemId must be an integer"),

  body("addOns")
    .isArray({ min: 1 })
    .withMessage("addOns must be a non-empty array"),

  body("addOns.*.addOnId")
    .isInt({ min: 1 })
    .withMessage("Each add-on must have a valid addOnId"),

  body("addOns.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Each add-on quantity must be an integer >= 1"),

  handleValidationErrors,
];

exports.removeAddOnsValidation = [
  param("cartItemId").isInt().withMessage("cartItemId must be an integer"),

  body("addOnIds")
    .isArray({ min: 1 })
    .withMessage("addOnIds must be a non-empty array"),

  body("addOnIds.*")
    .isInt()
    .withMessage("addOnIds must contain only integers"),

  handleValidationErrors,
];
