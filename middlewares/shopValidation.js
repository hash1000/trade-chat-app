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

  body('leadTime')
    .optional({ nullable: true })
    .isString()
    .withMessage('leadTime must be a string, e.g. "15-30 days"'),

  body('payoutWalletId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('payoutWalletId must be a wallet ID')
    .toInt(),

  body('rating')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('Rating must be a number between 0 and 10')
    .toFloat(),

  body('likes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Likes must be a non-negative integer')
    .toInt(),

  ...assignmentValidationRules(),

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

  body('leadTime')
    .optional({ nullable: true })
    .isString()
    .withMessage('leadTime must be a string, e.g. "15-30 days"'),

  body('payoutWalletId')
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage('payoutWalletId must be a wallet ID')
    .toInt(),

  body('rating')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('Rating must be a number between 0 and 10')
    .toFloat(),

  body('likes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Likes must be a non-negative integer')
    .toInt(),

  ...assignmentValidationRules(),

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
 * ✅ Teams / Members / Editor / Images (shared by create & update)
 */
function assignmentValidationRules() {
  return [
    body('teams')
      .optional()
      .isArray()
      .withMessage('teams must be an array of team IDs'),

    body('teams.*')
      .isInt({ min: 1 })
      .withMessage('Each team ID must be a positive integer')
      .toInt(),

    body('members')
      .optional()
      .isArray()
      .withMessage('members must be an array of user IDs'),

    body('members.*')
      .isInt({ min: 1 })
      .withMessage('Each member ID must be a positive integer')
      .toInt(),

    body('editor')
      .optional({ nullable: true })
      .isInt({ min: 1 })
      .withMessage('editor must be a user ID')
      .toInt(),

    body('multiple_images')
      .optional()
      .isArray()
      .withMessage('multiple_images must be an array of image URLs'),
  ]
}

/**
 * ✅ Team assignment endpoint validation
 */
exports.assignTeamsValidation = [
  body('teamIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('teamIds must be a non-empty array'),

  body('teamIds.*')
    .isInt({ min: 1 })
    .withMessage('Each team ID must be a positive integer')
    .toInt(),

  body('teamId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('teamId must be a positive integer')
    .toInt(),

  handleValidationErrors,
]

/**
 * ✅ Member add/remove endpoint validation
 */
exports.shopMembersValidation = [
  body('userIds')
    .optional()
    .isArray({ min: 1 })
    .withMessage('userIds must be a non-empty array'),

  body('userIds.*')
    .isInt({ min: 1 })
    .withMessage('Each user ID must be a positive integer')
    .toInt(),

  body('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('userId must be a positive integer')
    .toInt(),

  handleValidationErrors,
]

/**
 * ✅ Editor assignment endpoint validation
 */
exports.setEditorValidation = [
  body('editorId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('editorId must be a positive integer')
    .toInt(),

  body('editor')
    .optional()
    .isInt({ min: 1 })
    .withMessage('editor must be a positive integer')
    .toInt(),

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
