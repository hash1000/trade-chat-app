const { body, validationResult, oneOf } = require("express-validator");
const User = require("../models/user");

// Validation middleware for signup
exports.validateSignup = [
  body("phoneNumber").notEmpty().withMessage("phone number is required"),
  handleValidationErrors,
];

// Validation middleware for verify
exports.validateVerify = [
  body("country_code").notEmpty().withMessage("Country code is required"),
  body("phoneNumber").notEmpty().withMessage("Phone number is required"),
  body("email").isEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required"),
  body("username").notEmpty().withMessage("Username is required"),
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
  body("gender")
    .isIn(["male", "female", "other"])
    .withMessage("Invalid gender"),
  body("country").notEmpty().withMessage("Country is required"),
  body("age").isInt({ min: 2 }).withMessage("Invalid age"),
  body("profilePic")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  handleValidationErrors,
];

// Validation middleware for Google sign-in
exports.validateGoogleSignup = [
  body("displayName").notEmpty().withMessage("Display name is required"),
  body("email").isEmail().withMessage("Invalid email"),
  body("country_code").notEmpty().withMessage("Country code is required"),
  body("phoneNumber")
    .optional()
    .isString()
    .withMessage("Phone number must be a string"),
  body("photoURL")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string"),
  handleValidationErrors,
];

// Validation middleware for login
exports.validateLogin = [
  oneOf([
    // Validation for email/password login
    [
      body("email").isEmail().withMessage("Invalid email"),
      body("password").notEmpty().withMessage("Password is required"),
    ],
    // Validation for phone number login
    [
      body("phoneNumber").notEmpty().withMessage("Phone number is required"),
      body("country_code").notEmpty().withMessage("Country code is required"),
    ],
  ]),
  handleValidationErrors,
];

// Validation middleware for forgot-password
exports.forgotPasswordValidation = [
  body("email").isEmail().withMessage("Invalid email"),
  handleValidationErrors,
];

// Validation middleware for forgot-password
exports.resetPasswordValidation = [
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

exports.validateUpdateProfile = [
  body("name")
    .optional()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters"),
];

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
