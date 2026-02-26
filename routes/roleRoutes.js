const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorization");
const RoleController = require("../controllers/RoleController");
const {
  updateUserRolesValidation,
  getUsersByRoleValidation,
  bulkUpdateUserRolesValidation,
  removeUserRoleValidation,
} = require("../middlewares/roleValidation");

const router = express.Router();
const roleController = new RoleController();

router.get(
  "/",
  authenticate,
  authorize(["admin"]),
  roleController.getAllRoles.bind(roleController)
);

router.get(
  "/users",
  authenticate,
  authorize(["admin"]),
  getUsersByRoleValidation,
  roleController.getUsersByRole.bind(roleController)
);

router.patch(
  "/users",
  authenticate,
  authorize(["admin"]),
  updateUserRolesValidation,
  roleController.updateUserRoles.bind(roleController)
);

router.patch(
  "/users/bulk",
  authenticate,
  authorize(["admin"]),
  bulkUpdateUserRolesValidation,
  roleController.bulkUpdateUserRoles.bind(roleController)
);

router.delete(
  "/users/role",
  authenticate,
  authorize(["admin"]),
  removeUserRoleValidation,
  roleController.removeUserRole.bind(roleController)
);

module.exports = router;
