const { body, validationResult } = require('express-validator')

// Validation middleware for signup
exports.updateCompanyProfileValidationRules = [
  body('companyName').trim().optional().isLength({ min: 2, max: 50 }).withMessage('Company name must be between 2 and 50 characters'),
  body('managerFirstName').trim().optional().isLength({ min: 2, max: 50 }).withMessage('Manager last name must be between 2 and 50 characters'),
  body('managerLastName').trim().optional().isLength({ min: 2, max: 50 }).withMessage('Manager last name must be between 2 and 50 characters'),
  body('companyPhone').trim().optional().matches(/^[0-9+\-\s]+$/).withMessage('Invalid phone number'),
  body('companyCountry').trim().optional().matches(/^[a-zA-Z\s]+$/).withMessage('Company country can only contain letters and spaces'),
  body('companyCity').trim().optional().matches(/^[a-zA-Z\s]+$/).withMessage('Company city can only contain letters and spaces'),
  body('companyZip').trim().optional().isLength({ min: 5, max: 10 }).withMessage('Invalid ZIP code'),
  body('deliveryCountry').trim().optional().matches(/^[a-zA-Z\s]+$/).withMessage('Delivery country can only contain letters and spaces'),
  body('deliveryCity').trim().optional().matches(/^[a-zA-Z\s]+$/).withMessage('Delivery city can only contain letters and spaces'),
  body('deliveryZip').trim().optional().isLength({ min: 5, max: 10 }).withMessage('Invalid delivery ZIP code'),
  handleValidationErrors
]

// Middleware to handle validation errors
function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
