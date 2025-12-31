const { body, param, query } = require('express-validator')

/**
 * CREATE PRODUCT
 */
exports.createProductValidation = [
  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isString()
    .withMessage('Product name must be a string'),

  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ gt: 0 })
    .withMessage('Price must be a number greater than 0'),

  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),

  body('quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a positive integer'),

  body('shopId')
    .notEmpty()
    .withMessage('Shop ID is required')
    .isInt()
    .withMessage('Shop ID must be an integer'),
]

/**
 * UPDATE PRODUCT
 */
exports.updateProductValidation = [
  param('productId')
    .isInt()
    .withMessage('Product ID must be an integer'),

  body('name')
    .optional()
    .isString()
    .withMessage('Product name must be a string'),

  body('price')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Price must be greater than 0'),

  body('rating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Rating must be between 0 and 5'),

  body('quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a positive integer'),
]

/**
 * DELETE PRODUCT
 */
exports.deleteProductValidation = [
  param('productId')
    .isInt()
    .withMessage('Product ID must be an integer'),
]

/**
 * Get PRODUCT
 */
exports.getProductValidation = [
  param('productId')
    .isInt()
    .withMessage('Product ID must be an integer'),
]

/**
 * GET PRODUCTS BY SHOP
 */
exports.getProductsByShopValidation = [
  param('shopId')
    .isInt()
    .withMessage('Shop ID must be an integer'),
]

/**
 * PAGINATED LIST
 */
exports.getPaginatedProductsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a number greater than 0'),

  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Limit must be a number greater than 0'),

  query('name')
    .optional()
    .isString()
    .withMessage('Name filter must be a string'),

  query('shopId')
    .optional()
    .isInt()
    .withMessage('Shop ID must be an integer'),
]

/**
 * ❌ Validation Error Handler
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      errors: errors.array(),
    })
  }
  next()
}
