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
  body("firstName").trim().optional(),

  body("lastName").trim().optional(),

  body("familyName").trim().optional(),

  body("documentType")
    .optional()
    .isIn(["passport", "id_card"])
    .withMessage("Document type must be one of passport, id_card"),

  body("documentValue").trim().optional(),

  // IBAN is optional; when provided, validate format
  body("iban").optional({ nullable: true }),

  body("accountName").trim().optional(),

  body("accountNo").trim().optional(),

  body("swift_code").trim().optional(),

  body("bank_name").trim().optional(),

  body("bank_address").trim().optional(),

  body("intermediate_bank_name").trim().optional(),

  body("intermediate_bank_swift").trim().optional(),

  body("intermediate_bank_address").trim().optional(),

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

  body("walletType")
    .optional()
    .isIn(["PERSONAL", "COMPANY"])
    .withMessage("walletType must be one of PERSONAL, COMPANY"),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false")
    .toBoolean(),

  body("testCard")
    .not()
    .exists()
    .withMessage("testCard can only be set by admin"),

  handleValidationErrors,
];

// Validation rules for updating a bank account
exports.updateBankAccountValidation = [
  param("id").isInt().withMessage("Invalid bank account id"),

  body("firstName").trim().optional(),
  body("lastName").trim().optional(),
  body("familyName").trim().optional(),
  body("documentType")
    .optional()
    .isIn(["passport", "id_card"])
    .withMessage("Document type must be one of passport, id_card"),
  body("documentValue").trim().optional(),

  body("iban").optional({ nullable: true }).trim(),
  body("accountName").trim().optional(),
  body("accountNo").trim().optional(),
  body("swift_code").trim().optional(),
  body("bank_name").trim().optional(),
  body("bank_address").trim().optional(),
  body("intermediate_bank_name").trim().optional(),
  body("intermediate_bank_swift").trim().optional(),
  body("intermediate_bank_address").trim().optional(),

  body("note")
    .trim()
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Note is too long"),
  body("walletType")
    .optional()
    .isIn(["PERSONAL", "COMPANY"])
    .withMessage("walletType must be one of PERSONAL, COMPANY"),
  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be true or false")
    .toBoolean(),
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
  body("bank_name")
    .trim()
    .notEmpty()
    .withMessage("Bank name is required"),

  body("iban").optional({ nullable: true }),

  body("swift_code")
    .trim()
    .notEmpty()
    .withMessage("SWIFT/BIC is required"),

  body("accountCurrency")
    .optional({ nullable: true }),

  body("bic")
    .trim()
    .notEmpty()
    .withMessage("BIC is required"),

  body("bank_address")
    .trim()
    .optional()
    .isLength({ max: 255 })
    .withMessage("Bank address is too long"),
  body("intermediate_bank_name")
    .trim()
    .optional()
    .isLength({ max: 100 })
    .withMessage("Intermediate bank name is too long"),
  body("intermediate_bank_swift")
    .trim()
    .optional()
    .isLength({ max: 100 })
    .withMessage("Intermediate bank SWIFT is too long"),
  body("intermediate_bank_address")
    .trim()
    .optional()
    .isLength({ max: 255 })
    .withMessage("Intermediate bank address is too long"),
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
