const { body, param, validationResult } = require('express-validator');

// Validation rules for creating a bank account
exports.createBankAccountValidation = [
  body('accountName')
    .trim()
    .notEmpty()
    .withMessage('Account name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Account name must be between 2 and 100 characters'),

  // IBAN is optional; when provided, validate format
  body('iban')
    .optional({ nullable: true })
    .trim()
    .isIBAN()
    .withMessage('Invalid IBAN'),

  body('swift_code')
    .trim()
    .notEmpty()
    .withMessage('SWIFT/BIC is required')
    .isLength({ min: 4, max: 11 })
    .withMessage('SWIFT/BIC seems invalid'),

  body('accountHolder')
    .trim()
    .notEmpty()
    .withMessage('Account holder is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Account holder must be between 2 and 100 characters'),

  body('accountCurrency')
    .trim()
    .notEmpty()
    .withMessage('Account currency is required')
    .isLength({ min: 3, max: 10 })
    .withMessage('Account currency seems invalid'),

  body('bic')
    .trim()
    .notEmpty()
    .withMessage('BIC is required')
    .isLength({ min: 4, max: 11 })
    .withMessage('BIC seems invalid'),

  body('intermediateBank').trim().optional().isLength({ max: 100 }).withMessage('Intermediate bank is too long'),
  body('beneficiaryAddress').trim().optional().isLength({ max: 255 }).withMessage('Beneficiary address is too long'),
  body('note').trim().optional().isLength({ max: 2000 }).withMessage('Note is too long'),

  body('classification')
    .optional()
    .isIn(['sender', 'receiver', 'both'])
    .withMessage('Classification must be one of sender, receiver or both'),

  handleValidationErrors,
];

// Validation rules for updating a bank account
exports.updateBankAccountValidation = [
  param('id').isInt().withMessage('Invalid bank account id'),

  body('accountName').trim().optional().isLength({ min: 2, max: 100 }).withMessage('Account name must be between 2 and 100 characters'),
  body('iban').optional({ nullable: true }).trim().isIBAN().withMessage('Invalid IBAN'),
  body('swift_code').trim().optional().isLength({ min: 4, max: 11 }).withMessage('SWIFT/BIC seems invalid'),
  body('accountHolder').trim().optional().isLength({ min: 2, max: 100 }).withMessage('Account holder must be between 2 and 100 characters'),
  body('accountCurrency').trim().optional().isLength({ min: 3, max: 10 }).withMessage('Account currency seems invalid'),
  body('bic').trim().optional().isLength({ min: 4, max: 11 }).withMessage('BIC seems invalid'),
  body('intermediateBank').trim().optional().isLength({ max: 100 }).withMessage('Intermediate bank is too long'),
  body('beneficiaryAddress').trim().optional().isLength({ max: 255 }).withMessage('Beneficiary address is too long'),
  body('note').trim().optional().isLength({ max: 2000 }).withMessage('Note is too long'),
  body('classification').optional().isIn(['sender', 'receiver', 'both']).withMessage('Classification must be one of sender, receiver or both'),

  handleValidationErrors,
];

// Simple param validation middleware for delete/reorder/get/:id
exports.idParamValidation = [
  param('id').isInt().withMessage('Invalid bank account id'),
  handleValidationErrors,
];

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
