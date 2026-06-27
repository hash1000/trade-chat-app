const express = require("express");
const router = express.Router();
const ServiceDiscountController = require("../controllers/ServiceDiscountController");
const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");

const discountController = new ServiceDiscountController();

// Public — no auth required
router.get("/validate", discountController.validateCode.bind(discountController));

// Redeem — any authenticated user
router.post("/:code/redeem", authMiddleware, discountController.redeemCode.bind(discountController));

// Get single discount by id — owner or admin
router.get(
  "/:discountId",
  authMiddleware,
  checkIntegerParam("discountId"),
  discountController.getDiscount.bind(discountController)
);

// Update discount (isActive, expiryDate) — owner or admin
router.patch(
  "/:discountId",
  authMiddleware,
  checkIntegerParam("discountId"),
  discountController.updateDiscount.bind(discountController)
);

// Delete a discount — owner or admin
router.delete(
  "/:discountId",
  authMiddleware,
  checkIntegerParam("discountId"),
  discountController.deleteDiscount.bind(discountController)
);

module.exports = router;
