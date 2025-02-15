const express = require("express");
const UserProfileController = require("../controllers/UserProfileController");
const authenticate = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");

const router = express.Router();
const userProfileController = new UserProfileController();

// User profile routes
router.get(
  "/:userId/profile",
  authenticate,
  userProfileController.getUserProfile.bind(userProfileController)
);

// Fetch all users
router.get(
  "/allUsers",
  authenticate,
  userProfileController.getAllUsers.bind(userProfileController)
);

// Fetch user tags
router.get(
  "/userTags",
  authenticate,
  userProfileController.getUserTags.bind(userProfileController)
);

// Like a user
router.get(
  "/:userId/like/:status",
  authenticate,
  userProfileController.createLike.bind(userProfileController)
);

// Dislike a user
router.get(
  "/:userId/dislike/:status",
  authenticate,
  userProfileController.createDislike.bind(userProfileController)
);

// Mark a user as favourite
router.get(
  "/:userId/favourite/:status",
  authenticate,
  userProfileController.createFavourite.bind(userProfileController)
);

// Add or remove a friend
router.get(
  "/:userId/friend/:status",
  authenticate,
  userProfileController.createFriendship.bind(userProfileController)
);

// Fetch user contacts
router.get(
  "/contacts",
  authenticate,
  userProfileController.getContacts.bind(userProfileController)
);

// Address_Routes

// Get all addresses
router.get(
  "/get-address",
  authenticate,
  userProfileController.getaddress.bind(userProfileController)
);

// Add a new address
router.post(
  "/address",
  authenticate,
  userProfileController.addAddress.bind(userProfileController)
);

// Update the pinned address
router.patch(
  "/address-pin/:addressId",
  authenticate,
  checkIntegerParam,
  userProfileController.updatePinAddress.bind(userProfileController)
);

// Update an address
router.patch(
  "/address/:addressId",
  authenticate,
  checkIntegerParam,
  userProfileController.updateAddress.bind(userProfileController)
);

// Delete an address
router.delete(
  "/address/:addressId",
  authenticate,
  checkIntegerParam,
  userProfileController.deleteAddress.bind(userProfileController)
);

// Get address by ID
router.get(
  "/get-address/:addressId",
  authenticate,
  checkIntegerParam,
  userProfileController.getAddressById.bind(userProfileController)
);

module.exports = router;
