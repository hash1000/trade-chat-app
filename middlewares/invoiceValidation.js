const { body, validationResult } = require('express-validator')

exports.createInvoiceValidator = [
  // Hand-written (web) invoices have no order.
  body('orderId').if(body('type').not().equals('custom')).isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('total').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('total must be a number'),
  body('bundle').optional({ nullable: true }).isObject().withMessage('bundle must be an object'),
  handleValidationErrors
]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
