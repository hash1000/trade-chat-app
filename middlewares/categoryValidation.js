const { body, validationResult } = require('express-validator')

exports.addCategoryValidator = [
    body("title")
    .notEmpty()
    .withMessage("title is required"),
  handleValidationErrors
]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
