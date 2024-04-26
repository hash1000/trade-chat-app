const { body, query, validationResult } = require('express-validator')

exports.createProductValidationRules = [
  body('title').notEmpty().withMessage('Title is required'),
  body('link').notEmpty().withMessage('Link is required'),
  body('quantity').notEmpty().withMessage('Quantity is required'),
  body('price').notEmpty().withMessage('Price is required'),
  body('category').notEmpty().withMessage('Category is required'),
  handleValidationErrors
]

exports.updateProductValidationRules = [
  body('title').optional().notEmpty().withMessage('Title is required'),
  body('link').optional().notEmpty().withMessage('Link is required'),
  body('quantity').optional().notEmpty().withMessage('Quantity is required'),
  body('price').optional().notEmpty().withMessage('Price is required'),
  handleValidationErrors
]

exports.getPaginatedProductsValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1 }).toInt(),
  query('title').optional().isString().notEmpty(),
  query('category').optional().isString().notEmpty(),
  handleValidationErrors
]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
