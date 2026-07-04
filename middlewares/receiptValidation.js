const {  query, body, param, validationResult } = require("express-validator");

exports.createReceiptValidation = [
  body("senderId").isInt().withMessage("senderId must be an integer"),
  body("receiverId").isInt().withMessage("receiverId must be an integer"),
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),
  body("walletType")
    .optional()
    .isIn(["PERSONAL", "COMPANY"])
    .withMessage("walletType must be PERSONAL or COMPANY"),
  body("note")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("note must be a string up to 1000 characters"),
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
  // walletType is set once at creation and is immutable afterward.
  body("walletType").not().exists().withMessage("walletType cannot be changed after creation"),
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
  // walletType is set once at creation and is immutable afterward.
  body("walletType").not().exists().withMessage("walletType cannot be changed after creation"),
  handleValidationErrors,
];

exports.getValidation = [
  query('type')
    .optional({ checkFalsy: true }) // Makes the 'type' query optional, but validates if provided
    .isIn(['all', 'my'])  // Ensures 'type' is either 'all' or 'my'
    .withMessage('The "type" query must be either "all" or "my".'),
  query('pagination')
    .optional({ checkFalsy: true })
    .isIn(['true', 'false'])
    .withMessage('The "pagination" query must be either "true" or "false".'),
  query('page')
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('The "page" query must be a positive integer.'),
  query('limit')
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('The "limit" query must be an integer between 1 and 100.'),
  query('status')
    .optional({ checkFalsy: true })
    .isIn(['all', 'pending', 'approved', 'rejected', 'hold', 'locked'])
    .withMessage('The "status" query must be one of: all, pending, approved, rejected, hold, locked.'),
  handleValidationErrors, // Middleware to handle errors
];

exports.idParamValidation = [
  param("id").isInt().withMessage("Invalid receipt id"),
  handleValidationErrors,
];

exports.bulkDeleteValidation = [
  body("ids")
    .isArray({ min: 1 })
    .withMessage("ids must be a non-empty array of receipt ids"),
  body("ids.*").isInt().withMessage("Each id must be an integer"),
  handleValidationErrors,
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ errors: errors.array() });
  next();
}
