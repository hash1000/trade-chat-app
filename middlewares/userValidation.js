const { body, validationResult, oneOf } = require("express-validator");
const User = require("../models/user");

// Middleware to handle validation errors
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

exports.emailPhoneNumberValidation = [
  oneOf([
    // Validation for email/password login
    [body("email").isEmail().withMessage("Invalid email")],
    // Validation for phone number login
    [
      body("phoneNumber").notEmpty().withMessage("Phone number is required"),
      body("country_code").notEmpty().withMessage("Country code is required"),
    ],
  ]),
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
  body("settings.paymentCode").optional()
  .isString().withMessage("Payment code must be a string"),
  body("settings.tags").optional()
  .isArray().withMessage("Tags must be an array"),
  body("settings.emails").optional()
  .isArray().withMessage("Emails must be an array"),
  body("settings.phoneNumbers").optional()
  .isArray().withMessage("Phone numbers must be an array"),
  body("settings.description").optional()
  .isString().withMessage("Description must be a string"),  
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  handleValidationErrors,
];

// Validation middeleware for Google sign-in
exports.validateGoogleSignup = [
  body("displayName").notEmpty().withMessage("Display name is required"),
  body("email").isEmail().withMessage("Invalid email"),
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

// Validation middleware for email OTP
exports.validateEmailOtp = [
  body("email").isEmail().withMessage("Invalid email"),
  body("type").notEmpty().withMessage("Type required"),
  handleValidationErrors,
];

exports.validatePhoneOtp = [
  body("country_code")
    .notEmpty()
    .withMessage("Country code is required")
    .matches(/^\+\d{1,4}$/)
    .withMessage("Invalid country code format. Use a format like +1, +91, etc."),
  body("phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required")
    .isNumeric()
    .withMessage("Phone number must be numeric")
    .isLength({ min: 6, max: 15 })
    .withMessage("Phone number must be between 6 to 15 digits"),
  body("type").notEmpty().withMessage("Type is required"),
  handleValidationErrors,
];

exports.validateVerifySmsOtp = [
  body("otp")
    .notEmpty()
    .withMessage("OTP is required")
    .isNumeric()
    .withMessage("OTP must be a numeric value")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits"),
    body("country_code")
    .notEmpty()
    .withMessage("Country code is required")
    .matches(/^\+\d{1,4}$/)
    .withMessage("Invalid country code format. Use a format like +1, +91, etc."),
    body("phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required")
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage(
      "Phone number must be in valid E.164 format (e.g., +1234567890)"
    ),
  handleValidationErrors,
];

exports.validateVerifyEmailOtp = [
  body("verification_key")
    .notEmpty()
    .withMessage("Verification key is required"),
  body("otp").notEmpty().withMessage("OTP is required"),
  body("check").notEmpty().withMessage("Check value is required"),
  handleValidationErrors,
];

exports.validateUpdateContact = [
  body("userName")
    .optional()
    .isString()
    .withMessage("User name must be a string"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  body("profilePic")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  handleValidationErrors,
];


// Validation middleware for forgot-password
exports.forgotPasswordValidation = [
  body("email").isEmail().withMessage("Invalid email"),
  handleValidationErrors,
];

// Validation middleware for reset-password
exports.resetPasswordValidation = [
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];
// User Delete Validation
exports.userDeleteValidation = [
  body("userId").notEmpty().withMessage("userId is required"),
  handleValidationErrors,
];
// User Role Update
exports.userRoleUpdateValidation = [
  body("role").notEmpty().withMessage("Role is required"),
  body("requesteeId").notEmpty().withMessage("id is required"),
  handleValidationErrors,
];
// Validation middleware for updating profile
exports.validateUpdateProfile = [
  body("country_code")
    .optional()
    .notEmpty()
    .withMessage("Country code is required"),
  body("phoneNumber")
    .optional()
    .notEmpty()
    .withMessage("Phone number is required"),
  body("username").optional().notEmpty().withMessage("Username is required"),
  body("firstName").optional().notEmpty().withMessage("First name is required"),
  body("lastName").optional().notEmpty().withMessage("Last name is required"),
  body("gender")
    .optional()
    .isIn(["male", "female", "other"])
    .withMessage("Invalid gender"),
  body("country").optional().notEmpty().withMessage("Country is required"),
  body("age").optional().isInt({ min: 2 }).withMessage("Invalid age"),
  body("profilePic")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string"),
  body("settings.paymentCode").optional()
    .isString().withMessage("Payment code must be a string"),
  body("settings.tags").optional()
    .isArray().withMessage("Tags must be an array"),
  body("settings.emails").optional()
    .isArray().withMessage("Emails must be an array"),
  body("settings.phoneNumbers").optional()
    .isArray().withMessage("Phone numbers must be an array"),
  body("settings.description").optional()
    .isString().withMessage("Description must be a string"),  
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  handleValidationErrors,
];
