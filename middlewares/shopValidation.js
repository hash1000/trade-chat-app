const { body, query, validationResult } = require('express-validator')

/**
 * ✅ Create Shop Validation
 */
exports.createShopValidationRules = [
  body('header_image')
    .notEmpty()
    .withMessage('Header image is required')
    .isString()
    .withMessage('Header image must be a string'),

  body('profile_image')
    .notEmpty()
    .withMessage('Profile image is required')
    .isString()
    .withMessage('Profile image must be a string'),

  body('name')
    .notEmpty()
    .withMessage('Shop name is required')
    .isString()
    .withMessage('Shop name must be a string'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),

  body('country')
    .notEmpty()
    .withMessage('Country is required')
    .isString()
    .withMessage('Country must be a string'),

  handleValidationErrors,
]

/**
 * ✅ Update Shop Validation
 */
exports.updateShopValidationRules = [
  body('header_image')
    .optional()
    .isString()
    .withMessage('Header image must be a string'),

  body('profile_image')
    .optional()
    .isString()
    .withMessage('Profile image must be a string'),

  body('name')
    .optional()
    .isString()
    .withMessage('Shop name must be a string'),

  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),

  body('country')
    .optional()
    .isString()
    .withMessage('Country must be a string'),

  handleValidationErrors,
]

/**
 * ✅ Paginated Shops Validation
 */
exports.getPaginatedShopsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Limit must be a positive integer')
    .toInt(),

  query('shop_name')
    .optional()
    .isString()
    .withMessage('Shop name must be a string'),

  query('country')
    .optional()
    .isString()
    .withMessage('Country must be a string'),

  handleValidationErrors,
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
