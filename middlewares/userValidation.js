const { body, validationResult } = require('express-validator')
const User = require('../models/user')

// Validation middleware for signup
exports.validateSignup = [
  body('phoneNumber').notEmpty().withMessage('phone number is required'),
  handleValidationErrors
]

// Validation middleware for verify 
exports.validateVerify = [
  body('phoneNumber').notEmpty().withMessage('phone number is required'),
  body('requestId').notEmpty().withMessage('request Id is required'),
  body('code').notEmpty().withMessage('code is required'),
  handleValidationErrors
]

// Validation middleware for login
exports.validateLogin = [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
]
// Validation middleware for forgot-password
exports.forgotPasswordValidation = [
  body('email').isEmail().withMessage('Invalid email'),
  handleValidationErrors
]

// Validation middleware for forgot-password
exports.resetPasswordValidation = [
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
]

exports.validateUpdateProfile = [
  body('name').optional().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
]

// Middleware to handle validation errors
function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
