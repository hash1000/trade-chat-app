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
exports.createTopupValidator = [
  // Basic topup validation
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a number greater than 0')
    .notEmpty()
    .withMessage('Amount is required'),
  
  // Card details validation
  body('cardDetails.card_number')
    .isCreditCard()
    .withMessage('Invalid credit card number')
    .notEmpty()
    .withMessage('Card number is required'),
  
  body('cardDetails.exp_month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Expiration month must be between 1 and 12')
    .notEmpty()
    .withMessage('Expiration month is required'),
  
  body('cardDetails.exp_year')
    .isInt({ min: new Date().getFullYear() })
    .withMessage(`Expiration year must be ${new Date().getFullYear()} or later`)
    .notEmpty()
    .withMessage('Expiration year is required'),
  
  body('cardDetails.cvc')
    .isLength({ min: 3, max: 4 })
    .withMessage('CVC must be 3 or 4 digits')
    .isNumeric()
    .withMessage('CVC must contain only numbers')
    .notEmpty()
    .withMessage('CVC is required'),
  
  // Optional metadata
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  handleValidationErrors
];

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
