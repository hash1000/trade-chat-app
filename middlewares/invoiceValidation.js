const { body, validationResult } = require('express-validator')

exports.createInvoiceValidator = [
  body('orderId').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  handleValidationErrors
]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
