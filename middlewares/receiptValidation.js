const {  query, body, param, validationResult } = require("express-validator");

exports.createReceiptValidation = [
  body("senderId").isInt().withMessage("senderId must be an integer"),
  body("receiverId").isInt().withMessage("receiverId must be an integer"),
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),
  handleValidationErrors,
];

exports.updateReceiptValidation = [
  param("id").isInt().withMessage("Invalid receipt id"),
  body("senderId")
    .optional()
    .isInt()
    .withMessage("senderId must be an integer"),
  body("receiverId")
    .optional()
    .isInt()
    .withMessage("receiverId must be an integer"),
  body("amount")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),
  handleValidationErrors,
];

exports.getValidation = [
  query('type')
    .optional({ checkFalsy: true }) // Makes the 'type' query optional, but validates if provided
    .isIn(['all', 'my'])  // Ensures 'type' is either 'all' or 'my'
    .withMessage('The "type" query must be either "all" or "my".'),
  handleValidationErrors, // Middleware to handle errors
];

exports.idParamValidation = [
  param("id").isInt().withMessage("Invalid receipt id"),
  handleValidationErrors,
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ errors: errors.array() });
  next();
}
