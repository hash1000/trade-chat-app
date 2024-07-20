const express = require('express')
const router = express.Router()

const ProductController = require('../controllers/ProductController')
const authMiddleware = require('../middlewares/authenticate')
const {
  createProductValidationRules,
  updateProductValidationRules,
  getPaginatedProductsValidation
} = require('../middlewares/productValidation')

const productController = new ProductController()

// Define the route handlers
router.post(
  '/', authMiddleware, createProductValidationRules, productController.createProduct.bind(productController)
)
router.put(
  '/:productId', authMiddleware, updateProductValidationRules, productController.updateProduct.bind(productController)
)
router.delete('/:productId', authMiddleware, productController.deleteProduct.bind(productController))
router.get('/', authMiddleware, productController.getProducts.bind(productController))
router.get('/list', authMiddleware, getPaginatedProductsValidation, productController.getPaginatedProducts.bind(productController))

module.exports = router
