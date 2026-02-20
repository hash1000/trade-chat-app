const { body, param, validationResult } = require('express-validator');

exports.createReceiptValidation = [
  body('senderId').isInt().withMessage('senderId must be an integer'),
  body('receiverId').isInt().withMessage('receiverId must be an integer'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be a number greater than 0'),
  handleValidationErrors,
];

exports.updateReceiptValidation = [
  param('id').isInt().withMessage('Invalid receipt id'),
  body('senderId').optional().isInt().withMessage('senderId must be an integer'),
  body('receiverId').optional().isInt().withMessage('receiverId must be an integer'),
  body('amount').optional().isFloat({ gt: 0 }).withMessage('amount must be a number greater than 0'),
  handleValidationErrors,
];

exports.idParamValidation = [param('id').isInt().withMessage('Invalid receipt id'), handleValidationErrors];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}
