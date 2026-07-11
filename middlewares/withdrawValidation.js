const { query, body, param, validationResult } = require("express-validator");

// Wallets currently support these currencies (see WalletService.getOrCreateWallet)
const SUPPORTED_CURRENCIES = ["USD", "EUR", "CNY"];

exports.createWithdrawValidation = [
  body("bankCardId").isInt().withMessage("bankCardId must be an integer"),
  body("amount")
    .isFloat({ gt: 0 })
    .withMessage("amount must be a number greater than 0"),
  body("currency")
    .isString()
    .trim()
    .toUpperCase()
    .isIn(SUPPORTED_CURRENCIES)
    .withMessage(`currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}`),
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

exports.payWithdrawValidation = [
  param("id").isInt().withMessage("Invalid withdraw id"),
  body("newAmount")
    .optional()
    .isFloat({ gt: 0 })
    .withMessage("newAmount must be a number greater than 0"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("description must be a string up to 1000 characters"),
  handleValidationErrors,
];

exports.refundWithdrawValidation = [
  param("id").isInt().withMessage("Invalid withdraw id"),
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("description must be a string up to 1000 characters"),
  handleValidationErrors,
];

exports.getValidation = [
  query("type")
    .optional({ checkFalsy: true })
    .isIn(["all", "my"])
    .withMessage('The "type" query must be either "all" or "my".'),
  query("pagination")
    .optional({ checkFalsy: true })
    .isIn(["true", "false"])
    .withMessage('The "pagination" query must be either "true" or "false".'),
  query("page")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage('The "page" query must be a positive integer.'),
  query("limit")
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 100 })
    .withMessage('The "limit" query must be an integer between 1 and 100.'),
  query("status")
    .optional({ checkFalsy: true })
    .isIn(["all", "pending", "paid", "refunded"])
    .withMessage('The "status" query must be one of: all, pending, paid, refunded.'),
  query("days")
    .optional({ checkFalsy: true })
    .custom((value) => value === "all" || (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 365))
    .withMessage('The "days" query must be "all" or an integer between 1 and 365.'),
  query("startDate")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('The "startDate" query must be a valid date (YYYY-MM-DD).'),
  query("endDate")
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('The "endDate" query must be a valid date (YYYY-MM-DD).')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
        throw new Error('The "endDate" must be on or after "startDate".');
      }
      return true;
    }),
  query("currency")
    .optional({ checkFalsy: true })
    .custom((value) => value === "all" || /^[A-Za-z]{3}$/.test(value))
    .withMessage('The "currency" query must be "all" or a 3-letter code like USD, EUR, RMB.'),
  query("minAmount")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('The "minAmount" query must be a number greater than or equal to 0.'),
  query("maxAmount")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage('The "maxAmount" query must be a number greater than or equal to 0.')
    .custom((value, { req }) => {
      if (req.query.minAmount && Number(value) < Number(req.query.minAmount)) {
        throw new Error('The "maxAmount" must be greater than or equal to "minAmount".');
      }
      return true;
    }),
  query("excludeAdmin")
    .optional({ checkFalsy: true })
    .isIn(["true", "false"])
    .withMessage('The "excludeAdmin" query must be either "true" or "false".'),
  handleValidationErrors,
];

exports.idParamValidation = [
  param("id").isInt().withMessage("Invalid withdraw id"),
  handleValidationErrors,
];

exports.bulkDeleteValidation = [
  body("ids")
    .isArray({ min: 1 })
    .withMessage("ids must be a non-empty array of withdraw ids"),
  body("ids.*").isInt().withMessage("Each id must be an integer"),
  handleValidationErrors,
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(422).json({ errors: errors.array() });
  next();
}
