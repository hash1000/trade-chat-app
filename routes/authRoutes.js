const express = require("express");
const UserController = require("../controllers/UserController");
const {
  validateSignup,
  validateVerify,
  validateLogin,
  forgotPasswordValidation,
  resetPasswordValidation,
  validateUpdateProfile,
} = require("../middlewares/userValidation");
const decodeToken = require("../middlewares/decodeToken");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();
const userController = new UserController();

// Signup route
router.post(
  "/signup",
  validateSignup,
  userController.signup.bind(userController)
);
router.post(
  "/verify",
  validateVerify,
  userController.verify.bind(userController)
);

// Login route
router.post("/login", validateLogin, userController.login.bind(userController));

// Forgot password route
router.post(
  "/forgot-password",
  forgotPasswordValidation,
  userController.forgotPassword.bind(userController)
);

// Reset Password route
router.post(
  "/reset-password",
  resetPasswordValidation,
  decodeToken,
  userController.resetPassword.bind(userController)
);
// Get logged in user
router.get("/user", authenticate, userController.getUser.bind(userController));
// Update logged in user profile
router.put(
  "/profile",
  authenticate,
  validateUpdateProfile,
  userController.updateUser.bind(userController)
);

router.get(
  "/users",
  authenticate,
  userController.getUsers.bind(userController)
);
router.post(
  "/users",
  authenticate,
  userController.getUsersByPhoneNumbers.bind(userController)
);
router.post(
  "/users-by-id",
  authenticate,
  userController.getUsersById.bind(userController)
);

router.post(
  "/change-password",
  userController.changePassword.bind(userController)
);
router.post("/create-admin", userController.createAdmin.bind(userController));
router.post(
  "/update-fcm",
  authenticate,
  userController.updateFCM.bind(userController)
);
router.post(
  "/verify-email-phone",
  authenticate,
  userController.verifyEmailOrPhone.bind(userController)
);
router.post(
  "/make-primary",
  authenticate,
  userController.makePrimary.bind(userController)
);

module.exports = router;
