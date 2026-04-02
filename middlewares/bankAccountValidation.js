const { body, param, validationResult } = require("express-validator");

const TEST_CARD_CURRENCIES = ["EUR", "USD"];

const isThreeLetterCurrency = (value) =>
  typeof value === "string" && /^[A-Za-z]{3}$/.test(value.trim());

const parseTestCardCurrencyInput = (value, options = {}) => {
  const { allowEmpty = false } = options;

  if (value === undefined) {
    if (allowEmpty) {
      return [];
    }

    throw new Error("Test card currency is required");
  }

  if (value === null || value === "") {
    if (allowEmpty) {
      return [];
    }

    throw new Error("Test card currency is required");
  }

  let rawValues;

  if (Array.isArray(value)) {
    rawValues = value;
  } else {
    const normalizedValue = String(value).trim();

    if (normalizedValue.startsWith("[")) {
      try {
        const parsedValue = JSON.parse(normalizedValue);

        if (!Array.isArray(parsedValue)) {
          throw new Error("Test card currency must be an array");
        }

        rawValues = parsedValue;
      } catch (error) {
        throw new Error("Test card currency must be a valid array string");
      }
    } else {
      rawValues = normalizedValue
        .split(/[\s,/]+/)
        .filter(Boolean);
    }
  }

  const normalizedCurrencies = [...new Set(
    rawValues
      .map((entry) => String(entry || "").trim().toUpperCase())
      .filter(Boolean),
  )];

  if (!normalizedCurrencies.length && allowEmpty) {
    return [];
  }

  if (!normalizedCurrencies.length) {
    throw new Error("Test card currency is required");
  }

  if (normalizedCurrencies.length > TEST_CARD_CURRENCIES.length) {
    throw new Error("Test card can only use USD and EUR");
  }

  normalizedCurrencies.forEach((currency) => {
    if (!TEST_CARD_CURRENCIES.includes(currency)) {
      throw new Error("Test card currency must be USD or EUR");
    }
  });

  return normalizedCurrencies.sort(
    (left, right) =>
      TEST_CARD_CURRENCIES.indexOf(left) - TEST_CARD_CURRENCIES.indexOf(right),
  );
};

// Validation rules for creating a bank account
exports.createBankAccountValidation = [
  body("accountName")
    .trim()
    .notEmpty()
    .withMessage("Account name is required")
    // .isLength({ min: 2, max: 100 })
    .withMessage("Account name must be between 2 and 100 characters"),

  // IBAN is optional; when provided, validate format
  body("iban").optional({ nullable: true }),

  body("swift_code")
    .trim()
    .notEmpty()
    // .isLength({ min: 4, max: 11 })
    .withMessage("SWIFT/BIC seems invalid"),

  body("accountHolder")
    .trim()
    .notEmpty()
    .withMessage("Account holder is required")
    // .isLength({ min: 2, max: 100 })
    .withMessage("Account holder must be between 2 and 100 characters"),

  body("accountCurrency")
    .trim()
    .notEmpty()
    .withMessage("Account currency is required")
    // .isLength({ min: 3, max: 10 })
    .withMessage("Account currency seems invalid"),

  body("bic")
    .trim()
    .notEmpty()
    .withMessage("BIC is required")
    // .isLength({ min: 4, max: 11 })
    .withMessage("BIC seems invalid"),

  body("intermediateBank")
    .trim()
    .optional()
    .isLength({ max: 100 })
    .withMessage("Intermediate bank is too long"),
  body("beneficiaryAddress")
    .trim()
    .optional()
    .isLength({ max: 255 })
    .withMessage("Beneficiary address is too long"),
  body("note")
    .trim()
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Note is too long"),

  body("classification")
    .optional()
    .isIn(["sender", "receiver", "both"])
    .withMessage("Classification must be one of sender, receiver or both"),

    body("currency")
    .optional()
    .custom((value) => {
      if (!isThreeLetterCurrency(value)) {
        throw new Error("Currency must be a 3-letter code like USD or EUR");
      }
      return true;
    }),

  body("testCard")
    .not()
    .exists()
    .withMessage("testCard can only be set by admin"),

  handleValidationErrors,
];

// Validation rules for updating a bank account
exports.updateBankAccountValidation = [
  param("id").isInt().withMessage("Invalid bank account id"),

  body("accountName")
    .trim()
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Account name must be between 2 and 100 characters"),
  body("iban").optional({ nullable: true }).trim(),
  body("swift_code")
    .trim()
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("SWIFT/BIC seems invalid"),
  body("accountHolder")
    .trim()
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Account holder must be between 2 and 100 characters"),
  body("accountCurrency")
    .trim()
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Account currency seems invalid"),

  body("bic")
    .trim()
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("BIC seems invalid"),
  body("intermediateBank")
    .trim()
    .optional()
    .isLength({ max: 100 })
    .withMessage("Intermediate bank is too long"),
  body("beneficiaryAddress")
    .trim()
    .optional()
    .isLength({ max: 255 })
    .withMessage("Beneficiary address is too long"),
  body("note")
    .trim()
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Note is too long"),
  body("classification")
    .optional()
    .isIn(["sender", "receiver", "both"])
    .withMessage("Classification must be one of sender, receiver or both"),

  body("currency")
    .optional()
    .custom((value) => {
      if (!isThreeLetterCurrency(value)) {
        throw new Error("Currency must be a 3-letter code like USD or EUR");
      }
    }),
    
  body("testCard")
    .not()
    .exists()
    .withMessage("testCard can only be updated by admin"),

  handleValidationErrors,
];

// Simple param validation middleware for delete/reorder/get/:id
exports.idParamValidation = [
  param("id").isInt().withMessage("Invalid bank account id"),
  handleValidationErrors,
];

exports.createAdminTestCardValidation = [
  body("accountName")
    .trim()
    .notEmpty()
    .withMessage("Account name is required")
    .withMessage("Account name must be between 2 and 100 characters"),

  body("iban").optional({ nullable: true }),

  body("swift_code")
    .trim()
    .notEmpty()
    .withMessage("SWIFT/BIC seems invalid"),

  body("accountHolder")
    .trim()
    .notEmpty()
    .withMessage("Account holder is required")
    .withMessage("Account holder must be between 2 and 100 characters"),

  body("accountCurrency")
    .optional({ nullable: true }),

  body("bic")
    .trim()
    .notEmpty()
    .withMessage("BIC is required")
    .withMessage("BIC seems invalid"),

  body("intermediateBank")
    .trim()
    .optional()
    .isLength({ max: 100 })
    .withMessage("Intermediate bank is too long"),
  body("beneficiaryAddress")
    .trim()
    .optional()
    .isLength({ max: 255 })
    .withMessage("Beneficiary address is too long"),
  body("note")
    .trim()
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Note is too long"),

  body("classification")
    .optional()
    .isIn(["sender", "receiver", "both"])
    .withMessage("Classification must be one of sender, receiver or both"),

  body("currency")
    .custom((value) => {
      parseTestCardCurrencyInput(value);
      return true;
    }),

  handleValidationErrors,
];

exports.updateAdminTestCardValidation = [
  param("id").isInt().withMessage("Invalid bank account id"),

  body("testCard")
    .optional()
    .isBoolean()
    .withMessage("testCard must be true or false")
    .toBoolean(),

  body("accountCurrency")
    .optional({ nullable: true }),

  body("currency")
    .optional({ nullable: true })
    .custom((value) => {
      parseTestCardCurrencyInput(value, { allowEmpty: true });
      return true;
    }),

  handleValidationErrors,
];

exports.testCardCurrencyParamValidation = [
  param("currency").custom((value) => {
    const normalizedCurrency = String(value || "").trim().toUpperCase();
    if (!TEST_CARD_CURRENCIES.includes(normalizedCurrency)) {
      throw new Error("Currency must be USD or EUR");
    }
    return true;
  }),
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
