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

// Validation for admin updates to receipts. Admins are NOT allowed to update the original
// `amount` field; they may set a `newAmount` and update `status` (including 'hold'), and
// optionally adjust sender/receiver references.
exports.adminUpdateValidation = [
  param("id").isInt().withMessage("Invalid receipt id"),
  body("amount").not().exists().withMessage("Admins cannot update the original amount"),
  body("newAmount")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("newAmount must be a number greater than 0"),
  body("status")
    .optional()
    .isIn(["pending", "approved", "rejected", "hold"]) // make sure 'hold' is allowed
    .withMessage("Invalid status"),
  body("senderId")
    .optional()
    .isInt()
    .withMessage("senderId must be an integer"),
  body("receiverId")
    .optional()
    .isInt()
    .withMessage("receiverId must be an integer"),
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
