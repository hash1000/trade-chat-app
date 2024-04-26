const { body, validationResult } = require('express-validator')

exports.createOrderValidator = [
  body('name').notEmpty().withMessage('Name is required.'),
  body('image').notEmpty().withMessage('Image is required.'),
  handleValidationErrors
]

// exports.updateOrderValidator = [
//   body('products').isArray({ min: 1 }).withMessage('Products must be a non-empty array.'),
//   handleValidationErrors
// ]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
