const express = require("express");
const router = express.Router();

const CartController = require("../controllers/CartController");
const authMiddleware = require("../middlewares/authenticate");
const OrderCartController = require("../controllers/OrderCartController");

const cartController = new CartController();
const orderCartController = new OrderCartController();

// ── Service → Cart (smart entry point) ────────────────────────────────────────
// POST /cart/services
//   No active carts → auto-create + add
//   Active carts + no cartId → 200 SELECT_CART (return list of carts to choose from)
//   cartId = "new"  → force-create new cart + add
//   cartId = <id>   → add to specific cart (duplicate service → 409)
router.post("/services", authMiddleware, cartController.addService.bind(cartController));

// ── Cart read & delete ─────────────────────────────────────────────────────────
router.get("/", authMiddleware, cartController.listCarts.bind(cartController));
router.get("/:cartId", authMiddleware, cartController.getCart.bind(cartController));
router.delete("/:cartId", authMiddleware, cartController.deleteCart.bind(cartController));

// ── Cart item management ───────────────────────────────────────────────────────
// Batch update — must be declared before the :cartItemId route so "quantity" is
// not captured as a cartItemId param.
router.patch("/:cartId/items/quantity", authMiddleware, cartController.updateItemsQuantity.bind(cartController));
router.patch("/:cartId/items/:cartItemId", authMiddleware, cartController.updateItemQuantity.bind(cartController));
// Batch delete — declared before the :cartItemId route to avoid param capture.
router.delete("/:cartId/items", authMiddleware, cartController.removeItems.bind(cartController));
router.delete("/:cartId/items/:cartItemId", authMiddleware, cartController.removeItem.bind(cartController));

// ── Add-ons on a cart item ─────────────────────────────────────────────────────
router.post("/:cartId/items/:cartItemId/add-ons", authMiddleware, cartController.addAddOn.bind(cartController));
router.delete("/:cartId/items/:cartItemId/add-ons/:addOnId", authMiddleware, cartController.removeAddOn.bind(cartController));

// ── Discount on a cart item (service price only) ───────────────────────────────
router.post("/:cartId/items/:cartItemId/discount", authMiddleware, cartController.applyDiscount.bind(cartController));
router.delete("/:cartId/items/:cartItemId/discount", authMiddleware, cartController.removeDiscount.bind(cartController));

// ── Convert cart → DRAFT order ─────────────────────────────────────────────────
router.post("/:cartId/orders", authMiddleware, orderCartController.generateOrderFromCart.bind(orderCartController));

module.exports = router;
