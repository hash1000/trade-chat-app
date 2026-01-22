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
exports.createProductValidation = [
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isString()
    .withMessage("Product name must be a string"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ gt: 0 })
    .withMessage("Price must be a number greater than 0"),

  body("rating")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("Rating must be between 0 and 5"),

  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a positive integer"),

  body("shopId")
    .notEmpty()
    .withMessage("Shop ID is required")
    .isInt()
    .withMessage("Shop ID must be an integer"),

  body("productImages")
    .optional()
    .isArray()
    .withMessage("Product images must be an array")
    .bail() // Ensure that no further validation runs if the array is invalid
    .custom((images) => {
      if (images && images.length === 0) {
        throw new Error("At least one image is required");
      }
      return true;
    }),

  body("productImages.*.url")
    .optional()
    .notEmpty()
    .withMessage("URL for each image is required"),

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

  body("price")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("Price must be greater than 0"),

  body("rating")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("Rating must be between 0 and 5"),

  body("quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Quantity must be a positive integer"),

  body("productImages")
    .optional()
    .isArray()
    .withMessage("Product images must be an array")
    .bail() // Ensure that no further validation runs if the array is invalid
    .custom((images) => {
      if (images && images.length === 0) {
        throw new Error("At least one image is required");
      }
      return true;
    }),

  body("productImages.*.url")
    .optional()
    .notEmpty()
    .withMessage("URL for each image is required"),

  handleValidationErrors, // Make sure this is the last function to handle errors
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
