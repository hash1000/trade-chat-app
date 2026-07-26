const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const ProductCartController = require("../controllers/ProductCartController");
const {
  addToCartValidation,
  updateQuantityValidation,
  applyDiscountValidation,
  removeItemsValidation,
  addAddOnsValidation,
  removeAddOnsValidation,
} = require("../middlewares/productCartValidator");

const cartController = new ProductCartController();

// ── Read & add ──────────────────────────────────────────────────────────────
router.get("/", authMiddleware, cartController.getMyCart.bind(cartController));
router.post("/", authMiddleware, addToCartValidation, cartController.addToCart.bind(cartController));

// ── Quantity ────────────────────────────────────────────────────────────────
router.patch(
  "/:cartItemId/quantity",
  authMiddleware,
  updateQuantityValidation,
  cartController.updateQuantity.bind(cartController)
);

// ── Discount code on a cart line ───────────────────────────────────────────
router.post(
  "/:cartItemId/discount",
  authMiddleware,
  applyDiscountValidation,
  cartController.applyDiscountCode.bind(cartController)
);
router.delete(
  "/:cartItemId/discount",
  authMiddleware,
  checkIntegerParam("cartItemId"),
  cartController.removeDiscountCode.bind(cartController)
);

// ── Add-ons on an existing cart line ────────────────────────────────────────
router.post(
  "/:cartItemId/add-ons",
  authMiddleware,
  addAddOnsValidation,
  cartController.addAddOns.bind(cartController)
);
router.delete(
  "/:cartItemId/add-ons",
  authMiddleware,
  removeAddOnsValidation,
  cartController.removeAddOns.bind(cartController)
);

// ── Remove ──────────────────────────────────────────────────────────────────
// Batch delete — declared before the :cartItemId route to avoid param capture.
router.delete("/items", authMiddleware, removeItemsValidation, cartController.removeItems.bind(cartController));
router.delete(
  "/:cartItemId",
  authMiddleware,
  checkIntegerParam("cartItemId"),
  cartController.removeItem.bind(cartController)
);

// ── Clear entire cart ───────────────────────────────────────────────────────
router.delete("/", authMiddleware, cartController.clearCart.bind(cartController));

module.exports = router;
