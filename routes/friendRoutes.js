const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authenticate");
const UserProfileController = require("../controllers/UserProfileController");
const userProfileController = new UserProfileController();

// Tells the caller whether requesteeId is a friend and/or a favourite.
router.post(
  "/status",
  authMiddleware,
  userProfileController.getFriendFavouriteStatus.bind(userProfileController)
);

// Add requesteeId to the caller's friend list.
router.post(
  "/add",
  authMiddleware,
  userProfileController.addFriend.bind(userProfileController)
);

// Remove requesteeId from the caller's friend list.
router.post(
  "/remove",
  authMiddleware,
  userProfileController.removeFriend.bind(userProfileController)
);

// Update the caller's private overrides (nickname/photo/note) + rating/tags
// for a specific friend. Same body shape as the old chat-based update-friend.
router.put(
  "/update-friend",
  authMiddleware,
  userProfileController.updateFriendProfile.bind(userProfileController)
);

module.exports = router;
