const express = require('express')
const router = express.Router()

const ShopController = require('../controllers/ShopController')
const authMiddleware = require('../middlewares/authenticate')
const {
  createShopValidationRules,
  updateShopValidationRules,
  getPaginatedShopsValidation
} = require('../middlewares/shopValidation')

const shopController = new ShopController()

// Define the route handlers
router.post(
  '/', authMiddleware, createShopValidationRules, shopController.createShop.bind(shopController)
)
router.put(
  '/:shopId', authMiddleware, updateShopValidationRules, shopController.updateShop.bind(shopController)
)
router.delete('/:shopId', authMiddleware, shopController.deleteShop.bind(shopController))
router.get('/', authMiddleware, shopController.getShops.bind(shopController))
router.get('/:id', authMiddleware, shopController.getShopById.bind(shopController))
router.get('/list', authMiddleware, getPaginatedShopsValidation, shopController.getPaginatedShops.bind(shopController))

module.exports = router
