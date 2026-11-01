const { body, validationResult } = require("express-validator");

exports.createTemplateValidator = [
  body("title").isString().trim().notEmpty().withMessage("title is required")
    .isLength({ max: 255 }).withMessage("title must be at most 255 characters"),
  body("subTitle").optional({ nullable: true }).isString().withMessage("subTitle must be a string"),
  handleValidationErrors,
];

exports.updateTemplateValidator = [
  body("title").optional().isString().trim().notEmpty().withMessage("title cannot be empty")
    .isLength({ max: 255 }).withMessage("title must be at most 255 characters"),
  body("subTitle").optional({ nullable: true }).isString().withMessage("subTitle must be a string"),
  handleValidationErrors,
];

exports.reorderTemplatesValidator = [
  body("orderedIds").isArray({ min: 1 }).withMessage("orderedIds must be a non-empty array of template ids"),
  body("orderedIds.*").isInt({ min: 1 }).withMessage("orderedIds must contain template ids").toInt(),
  handleValidationErrors,
];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}
