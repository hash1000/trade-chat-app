const express = require("express");
const UserController = require("../controllers/UserController");
const {
  validateVerify,
  validateLogin,
  forgotPasswordValidation,
  resetPasswordValidation,
  validateUpdateProfile,
  userRoleUpdateValidation,
  validateGoogleSignup,
  validateEmailOtp,
  validateVerifyEmailOtp,
  emailPhoneNumberValidation,
  userDeleteValidation,
  validateVerifySmsOtp,
  validatePhoneOtp,
} = require("../middlewares/userValidation");
const decodeToken = require("../middlewares/decodeToken");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();
const userController = new UserController();

router.post(
  "/google-signIn",
  validateGoogleSignup,
  userController.googleSignIn.bind(userController)
);
router.put(
  "/google-profile",
  validateVerify,
  userController.GoogleProfile.bind(userController)
);

router.post(
  "/verify",
  validateVerify,
  userController.verify.bind(userController)
);

// Login route
router.post("/login", validateLogin, userController.login.bind(userController));

// sendOTP_to_email
router.post(
  "/send-otp-email",
  validateEmailOtp,
  userController.emailOtp.bind(userController)
);

// verifyOtp
router.post(
  "/verify-otp-email",
  validateVerifyEmailOtp,
  userController.verifyEmailOtp.bind(userController)
);

// sendOTP_via_twilio
router.post(
  "/send-otp-sms",
  validatePhoneOtp,
  userController.smsOtp.bind(userController)
);

// verifyOtp
router.post(
  "/verify-otp-sms",
  validateVerifySmsOtp,
  userController.verifySmsOtp.bind(userController)
);


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
//update  role 
router.patch(
  "/update-role",
  authenticate,
  userRoleUpdateValidation,
  userController.updateUserRole.bind(userController)
);

router.get(
  "/users",
  authenticate,
  userController.getUsers.bind(userController)
);
//get user from email
router.post(
  "/get-user",
  emailPhoneNumberValidation,
  userController.getUserByEmailOrPhoneNumber.bind(userController)
);
router.post(
  "/update-email-phoneNumber",
  authenticate,
  emailPhoneNumberValidation,
  userController.updateUserEmailOrPhoneNumber.bind(userController)
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
router.delete('/delete-user/:userId', 
  authenticate,
  userDeleteValidation,
  userController.userDelete.bind(userController)
);
module.exports = router;
