const { body, query, validationResult } = require('express-validator')

/**
 * A multipart body delivers arrays as strings — either JSON ("[1,2]") or a
 * single repeated value. Normalize both to an array before the isArray check.
 */
const toArray = (value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('[')) return [trimmed]
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

/**
 * header_image / profile_image are required on create, but may arrive either as
 * an uploaded file or as a plain URL string.
 */
const requireImage = (field, label) =>
  body(field).custom((value, { req }) => {
    if (req.files?.[field]?.length > 0) return true
    if (typeof value === 'string' && value.trim().length > 0) return true
    throw new Error(`${label} is required — upload a file or pass an image URL`)
  })

/**
 * ✅ Create Shop Validation
 */
exports.createShopValidationRules = [
  requireImage('header_image', 'Header image'),

  requireImage('profile_image', 'Profile image'),

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
      .customSanitizer(toArray)
      .isArray()
      .withMessage('teams must be an array of team IDs'),

    body('teams.*')
      .isInt({ min: 1 })
      .withMessage('Each team ID must be a positive integer')
      .toInt(),

    body('members')
      .optional()
      .customSanitizer(toArray)
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

    // Only validated when passed as URLs in the body; uploaded files land in
    // req.files and are checked by multer's image filter instead.
    body('multiple_images')
      .optional()
      .customSanitizer(toArray)
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
