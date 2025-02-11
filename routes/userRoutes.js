const express = require("express");
const UserProfileController = require("../controllers/UserProfileController");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();
const userProfileController = new UserProfileController();

router.get(
  "/:userId/profile",
  authenticate,
  userProfileController.getUserProfile.bind(userProfileController)
);
router.get(
  "/allUsers",
  authenticate,
  userProfileController.getAllUsers.bind(userProfileController)
);
router.get(
  "/userTags",
  authenticate,
  userProfileController.getUserTags.bind(userProfileController)
);
router.get(
  "/:userId/like/:status",
  authenticate,
  userProfileController.createLike.bind(userProfileController)
);
router.get(
  "/:userId/dislike/:status",
  authenticate,
  userProfileController.createDislike.bind(userProfileController)
);
router.get(
  "/:userId/favourite/:status",
  authenticate,
  userProfileController.createFavourite.bind(userProfileController)
);
router.get(
  "/:userId/friend/:status",
  authenticate,
  userProfileController.createFriendship.bind(userProfileController)
);
router.get(
  "/contacts",
  authenticate,
  userProfileController.getContacts.bind(userProfileController)
);

router.get(
  "/get-address",
  authenticate,
  userProfileController.getaddress.bind(userProfileController)
);

router.post(
  "/address",
  authenticate,
  userProfileController.addAddress.bind(userProfileController)
);
router.post(
  "/address-pin",
  authenticate,
  userProfileController.updatePinAddress.bind(userProfileController)
);

router.post(
  "/delete:addressId",
  authenticate,
  userProfileController.deleteAddress.bind(userProfileController)
);
router.put(
  "/address/:addressId",
  authenticate,
  userProfileController.updateAddress.bind(userProfileController)
);
router.delete(
  "/address/:addressId",
  authenticate,
  userProfileController.deleteAddress.bind(userProfileController)
);
router.get(
  "/address/:addressId",
  authenticate,
  userProfileController.getAddressById.bind(userProfileController)
);



module.exports = router;
