const express = require('express')
const router = express.Router()

const CartController = require('../controllers/CartController')
const authMiddleware = require('../middlewares/authenticate')
const { addItemToCartValidator } = require('../middlewares/cartValidation')
const cartController = new CartController()

// GET cart contents for a specific user
router.get('/', authMiddleware, cartController.getCart.bind(cartController))

// POST route to add an item to the cart
router.post('/add', authMiddleware, addItemToCartValidator, cartController.addItemToCart.bind(cartController))

// DELETE route to remove an item from the cart
router.delete('/remove/:productId', authMiddleware, cartController.removeItemFromCart.bind(cartController))

module.exports = router
