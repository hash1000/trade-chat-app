// middlewares/shortListValidation.js
const { body, validationResult } = require("express-validator");

exports.addShortItemValidator = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters"),

  // Optional fields
  body("description").optional().isString(),

  body("adminNote")
    .optional()
    .isString(),

  body("customerNote")
    .optional()
    .isString(),

  handleValidationErrors
];

// Function to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
