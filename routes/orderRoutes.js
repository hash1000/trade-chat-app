const express = require('express')
const router = express.Router()

const OrderController = require('../controllers/OrderController')
const authMiddleware = require('../middlewares/authenticate')
const {
  createOrderValidator
} = require('../middlewares/orderValidation')
const adminAuthenticate = require('../middlewares/authorization')
const orderController = new OrderController()

// Define the route handlers
router.post('/', adminAuthenticate, createOrderValidator, orderController.createOrder.bind(orderController))
router.get('/', adminAuthenticate, orderController.getUserOrders.bind(orderController))
router.put('/:orderNo', authMiddleware, orderController.UploadDocument.bind(orderController))
router.put('/:orderId', authMiddleware, orderController.updateOrder.bind(orderController))
router.get('/:orderId', authMiddleware, orderController.getOrderById.bind(orderController))
router.delete('/:orderId', authMiddleware, orderController.deleteOrder.bind(orderController))

module.exports = router
