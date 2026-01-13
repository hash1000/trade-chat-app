const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/authenticate')
const ShopProductController = require('../controllers/ShopProductController')

const {
  createProductValidation,
  updateProductValidation,
  deleteProductValidation,
  getProductsByShopValidation,
  getPaginatedProductsValidation,
  getProductValidation,
} = require('../middlewares/shopProductValidator')

const controller = new ShopProductController()

router.post(
  '/',
  authMiddleware,
  createProductValidation,
  controller.createProduct.bind(controller)
)

router.put(
  '/:productId',
  authMiddleware,
  updateProductValidation,
  controller.updateProduct.bind(controller)
)

router.delete(
  '/:productId',
  authMiddleware,
  deleteProductValidation,
  controller.deleteProduct.bind(controller)
)

router.get(
  '/list',
  authMiddleware,
  // getPaginatedProductsValidation,
  controller.getPaginatedProducts.bind(controller)
)

router.get(
  '/shop/:shopId',
  authMiddleware,
  getProductsByShopValidation,
  controller.getProductsByShop.bind(controller)
)

router.get(
  '/:productId',
  authMiddleware,
  getProductValidation,
  controller.getProductById.bind(controller)
)



module.exports = router
