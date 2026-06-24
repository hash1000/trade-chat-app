const express = require("express");
const router = express.Router();
const ServiceDiscountController = require("../controllers/ServiceDiscountController");
const authMiddleware = require("../middlewares/authenticate");

const discountController = new ServiceDiscountController();

// Public — no auth required
router.get("/validate", discountController.validateCode.bind(discountController));

// Redeem — any authenticated user
router.post("/:code/redeem", authMiddleware, discountController.redeemCode.bind(discountController));

// Disable/enable a discount — owner or admin
router.patch("/:discountId", authMiddleware, discountController.updateDiscount.bind(discountController));

module.exports = router;
