const express = require("express");
const router = express.Router();
const multer = require("multer");

const OrderController = require("../controllers/OrderController");
const authMiddleware = require("../middlewares/authenticate");
const {
  createOrderValidator,
  updateOrderAddressValidator,
} = require("../middlewares/orderValidation");
const authorize = require("../middlewares/authorization");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const checkPermission = require("../middlewares/permission");
const {
  uploadMultiple,
  uploadMultipleDisk,
} = require("../utilities/multer-config");
const multerHandler = require("../middlewares/multerHandler");
const orderController = new OrderController();

// Define the route handlers
router.post(
  "/:userId",
  authMiddleware,
  authorize(["admin", "operator"]),
  checkIntegerParam("userId"),
  checkPermission("create", "orders"),
  createOrderValidator,
  orderController.createOrder.bind(orderController)
);

router.get(
  "/user-orders/:userId",
  authMiddleware,
  authorize(["admin", "operator", "user"]),
  checkIntegerParam("userId"),
  checkPermission("readSingle", "orders"),
  orderController.getUserOrders.bind(orderController)
);

// Admin get all orders
router.get(
  "/all-orders",
  authMiddleware,
  authorize(["admin", "operator", "user"]),
  checkPermission("readAll", "orders"),
  orderController.getAllUserOrders.bind(orderController)
);

router.post(
  "/upload-documents/:orderNo",
  authMiddleware,
  multerHandler(uploadMultipleDisk),
  orderController.uploadDocument.bind(orderController)
);

// delete api for document
router.delete(
  "/:orderNo/delete-document/:documentId",
  authMiddleware,
  orderController.deleteDocument.bind(orderController)
);

router.patch(
  "/favorite/:orderId",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("orderId"),
  checkPermission("canUpdate", "orders"),
  orderController.isFavoriteOrder.bind(orderController)
);

router.patch(
  "/lock/:orderId",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("orderId"),
  checkPermission("canUpdate", "orders"),
  orderController.isLockOrder.bind(orderController)
);

router.patch(
  "/order-address/:orderId",
  authMiddleware,
  authorize(["admin"]),
  checkIntegerParam("orderId"),
  checkPermission("canUpdate", "orders"),
  updateOrderAddressValidator,
  orderController.updateOrderAddress.bind(orderController)
);

router.patch(
  "/:orderId",
  authMiddleware,
  authorize(["admin", "operator"]),
  checkIntegerParam("orderId"),
  checkPermission("canUpdate", "orders"),
  orderController.updateOrder.bind(orderController)
);

router.get(
  "/single-order/:orderId",
  checkIntegerParam("orderId"),
  authMiddleware,
  checkPermission("readSingle", "orders"),
  orderController.getOrderById.bind(orderController)
);

router.delete(
  "/:orderNo",
  authMiddleware,
  authorize(["admin", "operator"]),
  checkPermission("canDelete", "orders"),
  orderController.deleteOrder.bind(orderController)
);

module.exports = router;
