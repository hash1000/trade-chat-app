const { body, validationResult } = require('express-validator')

exports.createPaymentValidator = [
  body('amount').isFloat().notEmpty(),
  body('senderName').notEmpty(),
  body('orderNumber').notEmpty(),
  body('accountNumber').notEmpty(),
  body('accountType').isIn(['personal', 'company']).notEmpty().withMessage('accountType must be personal or company'),
  body('image').notEmpty(),
  handleValidationErrors
]

exports.updatePaymentValidator = [
  body('amount').isFloat().notEmpty(),
  body('senderName').notEmpty(),
  body('orderNumber').notEmpty(),
  body('accountNumber').notEmpty(),
  handleValidationErrors
]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
