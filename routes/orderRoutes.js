const express = require('express')
const router = express.Router()
const multer = require("multer");

const OrderController = require('../controllers/OrderController')
const authMiddleware = require('../middlewares/authenticate')
const {
  createOrderValidator,
  updateOrderAddressValidator
} = require('../middlewares/orderValidation')
const adminAuthenticate = require('../middlewares/authorization')
const checkIntegerParam = require('../middlewares/paramIntegerValidation')
const orderController = new OrderController()

// Configure multer storage
const upload = multer({ storage: multer.memoryStorage() });

// Define the route handlers
router.post('/:userId', adminAuthenticate,checkIntegerParam("userId"), createOrderValidator, orderController.createOrder.bind(orderController))
router.get('/user-orders/:userId', adminAuthenticate, checkIntegerParam("userId"), orderController.getUserOrders.bind(orderController))
// admin get all orders
router.get('/all-orders', adminAuthenticate, orderController.getAllUserOrders.bind(orderController))

// Upload document route
router.post(
  '/upload-documents/:orderNo',
  authMiddleware,
  upload.array('documents', 5), // Allow up to 5 files
  orderController.uploadDocument.bind(orderController)
);

router.patch('/favorite/:orderId',adminAuthenticate,checkIntegerParam("orderId"), orderController.isFavoriteOrder.bind(orderController))

router.patch('/order-address/:orderId',adminAuthenticate,checkIntegerParam("orderId"), updateOrderAddressValidator, orderController.updateOrderAddress.bind(orderController));

router.patch('/:orderId',adminAuthenticate,checkIntegerParam("orderId"), orderController.updateOrder.bind(orderController));

router.get('/single-order/:orderId', checkIntegerParam("orderId"), authMiddleware, orderController.getOrderById.bind(orderController));

router.delete('/:orderNo', authMiddleware, orderController.deleteOrder.bind(orderController));

module.exports = router
