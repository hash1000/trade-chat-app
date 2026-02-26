const { body, query, validationResult } = require("express-validator");

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

exports.updateUserRolesValidation = [
  body("requesteeId")
    .notEmpty()
    .withMessage("requesteeId is required")
    .isInt({ min: 1 })
    .withMessage("requesteeId must be a positive integer"),
  body("roles")
    .isArray({ min: 1 })
    .withMessage("roles must be a non-empty array"),
  body("roles.*")
    .isString()
    .withMessage("Each role must be a string")
    .trim()
    .notEmpty()
    .withMessage("Role name cannot be empty"),
  handleValidationErrors,
];

exports.getUsersByRoleValidation = [
  query("role")
    .notEmpty()
    .withMessage("role is required")
    .isString()
    .withMessage("role must be a string")
    .trim(),
  handleValidationErrors,
];

exports.bulkUpdateUserRolesValidation = [
  body("userIds")
    .isArray({ min: 1 })
    .withMessage("userIds must be a non-empty array"),
  body("userIds.*")
    .isInt({ min: 1 })
    .withMessage("Each userId must be a positive integer"),
  body("roles")
    .isArray({ min: 1 })
    .withMessage("roles must be a non-empty array"),
  body("roles.*")
    .isString()
    .withMessage("Each role must be a string")
    .trim()
    .notEmpty()
    .withMessage("Role name cannot be empty"),
  handleValidationErrors,
];

exports.removeUserRoleValidation = [
  body("userId")
    .notEmpty()
    .withMessage("userId is required")
    .isInt({ min: 1 })
    .withMessage("userId must be a positive integer"),
  body("role")
    .notEmpty()
    .withMessage("role is required")
    .isString()
    .withMessage("role must be a string")
    .trim(),
  handleValidationErrors,
];
