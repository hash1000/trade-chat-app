const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const ProductOrderController = require("../controllers/ProductOrderController");
const {
  checkoutValidation,
  paginationValidation,
  shopOrdersListValidation,
  myShopOrdersListValidation,
  updateStatusValidation,
  addChargeValidation,
  payChargeValidation,
} = require("../middlewares/productOrderValidator");

const orderController = new ProductOrderController();

// ── Checkout ─────────────────────────────────────────────────────────────────
router.post("/checkout", authMiddleware, checkoutValidation, orderController.checkout.bind(orderController));

// ── Buyer: my orders (parent orders, paginated) ─────────────────────────────
router.get("/", authMiddleware, paginationValidation, orderController.getMyOrders.bind(orderController));

// ── Shop owner: orders across every shop they own (paginated) ──────────────
// Declared before "/shop/:shopId" purely for readability; "shops" vs "shop"
// never collide as route segments.
router.get(
  "/shops/owner",
  authMiddleware,
  myShopOrdersListValidation,
  orderController.getOwnerShopOrders.bind(orderController)
);

// ── Shop owner / admin: this shop's orders (shop-orders, paginated) ────────
// Declared before "/:orderId" so "shop" is never captured as an orderId.
router.get(
  "/shop/:shopId",
  authMiddleware,
  shopOrdersListValidation,
  orderController.getShopOrders.bind(orderController)
);

// ── Single shop-order (buyer, or shop owner/admin) ──────────────────────────
router.get(
  "/shop-orders/:shopOrderId",
  authMiddleware,
  checkIntegerParam("shopOrderId"),
  orderController.getShopOrderById.bind(orderController)
);

// ── Status update (shop owner or admin only, forward-only) ─────────────────
router.patch(
  "/shop-orders/:shopOrderId/status",
  authMiddleware,
  updateStatusValidation,
  orderController.updateStatus.bind(orderController)
);

// ── Post-order charges, e.g. shipping/transport (shop owner or admin only) ─
router.post(
  "/shop-orders/:shopOrderId/charges",
  authMiddleware,
  addChargeValidation,
  orderController.addCharge.bind(orderController)
);

// Buyer pays a specific due charge from a wallet of their choosing.
router.post(
  "/charges/:chargeId/pay",
  authMiddleware,
  payChargeValidation,
  orderController.payCharge.bind(orderController)
);

// ── Single parent order (buyer) — keep last so literal routes above win ────
router.get(
  "/:orderId",
  authMiddleware,
  checkIntegerParam("orderId"),
  orderController.getMyOrderById.bind(orderController)
);

module.exports = router;
