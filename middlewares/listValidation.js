const { body, validationResult } = require('express-validator')

exports.addListValidator = [
    body("title")
    .notEmpty()
    .withMessage("title is required"),
     body("description").optional().isString(),
  handleValidationErrors
]

function handleValidationErrors (req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() })
  }
  next()
}
