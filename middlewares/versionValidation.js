const { body, validationResult } = require('express-validator');

exports.versionValidator = [
  body('version')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Version is required'),
  body('changelog')
    .optional()
    .isArray()
    .withMessage('changelog must be an array of strings'),
  body('changelog.*')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Each changelog entry must be a non-empty string'),
  handleValidationErrors
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
