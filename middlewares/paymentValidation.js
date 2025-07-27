const { body, validationResult } = require("express-validator");

exports.createPaymentValidator = [
  body("amount").isFloat().notEmpty(),
  body("senderName").notEmpty(),
  body("orderNumber").notEmpty(),
  body("accountNumber").notEmpty(),
  body("accountType")
    .isIn(["personal", "company"])
    .notEmpty()
    .withMessage("accountType must be personal or company"),
  body("image").notEmpty(),
  handleValidationErrors,
];


exports.currencyAdjustmentValidator = [
  body('adjustment')
    .exists().withMessage('Adjustment value is required')
    .isFloat().withMessage('Adjustment must be a number')
    .custom((value) => {
      if (Math.abs(value) > 10) {
        throw new Error('Adjustment cannot be more than ±10');
      }
      return true;
    }),

  body('currency')
    .optional()
    .isString().withMessage('Currency must be a string')
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters')
    .isUppercase().withMessage('Currency must be uppercase'),

  handleValidationErrors,
];


exports.updatePaymentValidator = [
  body("amount").isFloat().notEmpty(),
  body("senderName").notEmpty(),
  body("orderNumber").notEmpty(),
  body("accountNumber").notEmpty(),
  handleValidationErrors,
];
exports.createTopupValidator = [
  // Basic topup validation
  body("amount")
    .isFloat({ min: 1 })
    .withMessage("Amount must be a number greater than 0")
    .notEmpty()
    .withMessage("Amount is required"),

  handleValidationErrors,
];

// BALANCE SHEET (nested validation)
exports.createBalanceSheetValidator = [
  body("ledgers").isArray({ min: 1 }).withMessage("At least one ledger is required"),
  body("ledgers.*.title").notEmpty().withMessage("Ledger title is required"),
  body("ledgers.*.description").optional().isString(),
  body("ledgers.*.incomes").optional().isArray(),
  body("ledgers.*.incomes.*.amount")
    .optional({ nullable: true })
    .isFloat({ min: 0.01 })
    .withMessage("Income amount must be greater than 0"),
  body("ledgers.*.incomes.*.description").optional().isString(),
  body("ledgers.*.expenses").optional().isArray(),
  body("ledgers.*.expenses.*.amount")
    .optional({ nullable: true })
    .isFloat({ min: 0.01 })
    .withMessage("Expense amount must be greater than 0"),
  body("ledgers.*.expenses.*.description").optional().isString(),
  handleValidationErrors
];

// LEDGER
exports.addLedgerValidator = [
  body("title").notEmpty().withMessage("Title is required"),
  body("description").optional().isString(),
  body("balanceSheetId").isInt().withMessage("Valid balanceSheetId is required"),
  handleValidationErrors
];

// INCOME
exports.addIncomeValidator = [
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be greater than 0"),
  body("description").optional().isString(),
  body("paymentTypeId").isInt().withMessage("Valid paymentTypeId is required"),
  body("ledgerId").isInt().withMessage("Valid ledgerId is required"),
  handleValidationErrors
];

exports.bulkLedgerTransactionValidator = [
  body("incomes")
    .optional()
    .isArray()
    .withMessage("Incomes must be an array"),
  body("incomes.*.amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Income amount must be a valid number > 0"),
  body("incomes.*.description")
    .optional()
    .isString()
    .withMessage("Income description must be a string"),
  body("incomes.*.paymentTypeId")
    .optional()
    .isInt()
    .withMessage("Income paymentTypeId must be an integer"),

  body("expenses")
    .optional()
    .isArray()
    .withMessage("Expenses must be an array"),
  body("expenses.*.amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Expense amount must be a valid number > 0"),
  body("expenses.*.description")
    .optional()
    .isString()
    .withMessage("Expense description must be a string"),
  body("expenses.*.paymentTypeId")
    .optional()
    .isInt()
    .withMessage("Expense paymentTypeId must be an integer"),

  handleValidationErrors,
];

// EXPENSE
exports.addExpenseValidator = [
  body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be greater than 0"),
  body("description").optional().isString(),
  body("paymentTypeId").isInt().withMessage("Valid paymentTypeId is required"),
  body("ledgerId").isInt().withMessage("Valid ledgerId is required"),
  handleValidationErrors
];

// PAYMENT TYPE
exports.validatePaymentType = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 50 })
    .withMessage("Name must be less than 50 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value"),
  handleValidationErrors
];


function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
