const { body, param, query, validationResult } = require("express-validator");

// Handle validation result
/**
 * ❌ Validation Error Handler
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
}

/**
 * CREATE PRODUCT
 */
const sharedProductFieldRules = () => [
  body("description")
    .optional({ nullable: true })
    .isString()
    .withMessage("Description must be a string"),

  body("pricing_type")
    .optional()
    .isIn(["free", "fixed", "range"])
    .withMessage("pricing_type must be one of: free, fixed, range"),

  body("price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Price must be a number greater than 0"),

  body("min_price")
    .optional({ nullable: true })
    .isFloat({ min: 0 })
    .withMessage("min_price must be a non-negative number"),

  body("max_price")
    .optional({ nullable: true })
    .isFloat({ gt: 0 })
    .withMessage("max_price must be a number greater than 0"),

  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a positive integer"),

  // tags may arrive as an array (JSON body) or a JSON string (multipart)
  body("tags")
    .optional({ nullable: true })
    .custom((value) => {
      if (Array.isArray(value) || typeof value === "string") return true;
      throw new Error("tags must be an array of strings");
    }),

  body("insured").optional().isBoolean().withMessage("insured must be a boolean"),
  body("moneyBack").optional().isBoolean().withMessage("moneyBack must be a boolean"),
  body("support247").optional().isBoolean().withMessage("support247 must be a boolean"),

  // productImages may arrive as an array or a JSON string (multipart)
  body("productImages")
    .optional({ nullable: true })
    .custom((value) => {
      if (Array.isArray(value) || typeof value === "string") return true;
      throw new Error("productImages must be an array");
    }),
];

exports.createProductValidation = [
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isString()
    .withMessage("Product name must be a string"),

  body("shopId")
    .notEmpty()
    .withMessage("Shop ID is required")
    .isInt()
    .withMessage("Shop ID must be an integer"),

  ...sharedProductFieldRules(),

  handleValidationErrors,
];
/**
 * UPDATE PRODUCT
 */
exports.updateProductValidation = [
  param("productId").isInt().withMessage("Product ID must be an integer"),

  body("name")
    .optional()
    .isString()
    .withMessage("Product name must be a string"),

  ...sharedProductFieldRules(),

  handleValidationErrors, // Make sure this is the last function to handle errors
];

/**
 * RATE PRODUCT (per-user, 0-10)
 */
exports.rateProductValidation = [
  param("productId").isInt().withMessage("Product ID must be an integer"),

  body("rating")
    .notEmpty()
    .withMessage("rating is required")
    .isInt({ min: 0, max: 10 })
    .withMessage("rating must be an integer between 0 and 10"),

  body("comment")
    .optional({ nullable: true })
    .isString()
    .withMessage("comment must be a string"),

  handleValidationErrors,
];

/**
 * ADMIN BADGES
 */
exports.updateBadgesValidation = [
  param("productId").isInt().withMessage("Product ID must be an integer"),

  body("isTopChoice").optional().isBoolean().withMessage("isTopChoice must be a boolean"),
  body("isQRMVerified").optional().isBoolean().withMessage("isQRMVerified must be a boolean"),

  handleValidationErrors,
];

/**
 * DELETE PRODUCT
 */
exports.deleteProductValidation = [
  param("productId").isInt().withMessage("Product ID must be an integer"),
  handleValidationErrors,
];

/**
 * Get PRODUCT
 */
exports.getProductValidation = [
  param("productId").isInt().withMessage("Product ID must be an integer"),
  handleValidationErrors,
];

/**
 * GET PRODUCTS BY SHOP
 */
exports.getProductsByShopValidation = [
  param("shopId").isInt().withMessage("Shop ID must be an integer"),
  handleValidationErrors,
];

/**
 * PAGINATED LIST
 */
exports.getPaginatedProductsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a number greater than 0"),

  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Limit must be a number greater than 0"),

  query("name")
    .optional()
    .isString()
    .withMessage("Name filter must be a string"),

  query("shopId").optional().isInt().withMessage("Shop ID must be an integer"),
  handleValidationErrors,
];
