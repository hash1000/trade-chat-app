const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/authenticate')
const authorize = require('../middlewares/authorization')
const checkIntegerParam = require('../middlewares/paramIntegerValidation')
const ShopProductController = require('../controllers/ShopProductController')
const ShopProductFileController = require('../controllers/ShopProductFileController')
const ShopProductDiscountController = require('../controllers/ShopProductDiscountController')
const ShopProductVariationController = require('../controllers/ShopProductVariationController')
const ShopProductAddOnController = require('../controllers/ShopProductAddOnController')
const {
  uploadProductMedia,
  uploadProductCreateUpdate,
  uploadVariationImages,
  uploadAddOnImages,
} = require('../utilities/productFileMulter')

const {
  createProductValidation,
  updateProductValidation,
  deleteProductValidation,
  getProductsByShopValidation,
  getPaginatedProductsValidation,
  getProductValidation,
  rateProductValidation,
  updateBadgesValidation,
  assignCategoriesValidation,
} = require('../middlewares/shopProductValidator')

const controller = new ShopProductController()
const fileController = new ShopProductFileController()
const discountController = new ShopProductDiscountController()
const variationController = new ShopProductVariationController()
const addOnController = new ShopProductAddOnController()

// ── Public (no auth) product browsing ─────────────────────────────────────────

router.get(
  '/public/list',
  getPaginatedProductsValidation,
  controller.getPublicPaginatedProducts.bind(controller)
)

router.get(
  '/public/shop/:shopId',
  getProductsByShopValidation,
  controller.getPublicProductsByShop.bind(controller)
)

router.get(
  '/public/:productId',
  getProductValidation,
  controller.getPublicProductById.bind(controller)
)

// ── Discounts (literal routes BEFORE /:productId) ─────────────────────────────

// Public — no auth required
router.get('/discounts/validate', discountController.validateCode.bind(discountController))

// Redeem — any authenticated user
router.post('/discounts/:code/redeem', authMiddleware, discountController.redeemCode.bind(discountController))

// Single discount CRUD — shop owner
router.get(
  '/discounts/:discountId',
  authMiddleware,
  checkIntegerParam('discountId'),
  discountController.getDiscount.bind(discountController)
)

router.patch(
  '/discounts/:discountId',
  authMiddleware,
  checkIntegerParam('discountId'),
  discountController.updateDiscount.bind(discountController)
)

router.delete(
  '/discounts/:discountId',
  authMiddleware,
  checkIntegerParam('discountId'),
  discountController.deleteDiscount.bind(discountController)
)

// ── Quantity discount rules (literal routes BEFORE /:productId) ───────────────

router.patch(
  '/discount-rules/:ruleId',
  authMiddleware,
  checkIntegerParam('ruleId'),
  discountController.updateRule.bind(discountController)
)

router.delete(
  '/discount-rules/:ruleId',
  authMiddleware,
  checkIntegerParam('ruleId'),
  discountController.deleteRule.bind(discountController)
)

// ── Media files (literal route BEFORE /:productId) ────────────────────────────

router.delete(
  '/files/:fileId',
  authMiddleware,
  checkIntegerParam('fileId'),
  fileController.deleteFile.bind(fileController)
)

// ── Core CRUD ─────────────────────────────────────────────────────────────────

// create — accepts optional media[] files alongside JSON body fields
router.post(
  '/',
  authMiddleware,
  fileController.handleMulterError(uploadProductCreateUpdate),
  createProductValidation,
  controller.createProduct.bind(controller)
)

// update — accepts optional media[] files to append new files
router.put(
  '/:productId',
  authMiddleware,
  checkIntegerParam('productId'),
  fileController.handleMulterError(uploadProductCreateUpdate),
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

// my products — only the products of shops this user owns
router.get(
  '/my/list',
  authMiddleware,
  getPaginatedProductsValidation,
  controller.getMyProducts.bind(controller)
)

router.get(
  '/shop/:shopId',
  authMiddleware,
  getProductsByShopValidation,
  controller.getProductsByShop.bind(controller)
)

// ── Media upload ──────────────────────────────────────────────────────────────

router.post(
  '/:productId/media',
  authMiddleware,
  checkIntegerParam('productId'),
  fileController.handleMulterError(uploadProductMedia),
  fileController.uploadMedia.bind(fileController)
)

// ── Likes ─────────────────────────────────────────────────────────────────────

router.post('/:productId/like', authMiddleware, checkIntegerParam('productId'), controller.likeProduct.bind(controller))
router.delete('/:productId/like', authMiddleware, checkIntegerParam('productId'), controller.unlikeProduct.bind(controller))
router.get('/:productId/likes/count', authMiddleware, checkIntegerParam('productId'), controller.getLikesCount.bind(controller))
router.get('/:productId/likes/me', authMiddleware, checkIntegerParam('productId'), controller.checkUserLiked.bind(controller))

// ── Views ─────────────────────────────────────────────────────────────────────

router.get('/:productId/views/count', authMiddleware, checkIntegerParam('productId'), controller.getViewsCount.bind(controller))

// ── Ratings (per-user 0-10) ───────────────────────────────────────────────────

router.post('/:productId/rating', authMiddleware, rateProductValidation, controller.rateProduct.bind(controller))
router.put('/:productId/rating', authMiddleware, rateProductValidation, controller.rateProduct.bind(controller))
router.delete('/:productId/rating', authMiddleware, checkIntegerParam('productId'), controller.deleteRating.bind(controller))

// ── Admin badges ──────────────────────────────────────────────────────────────

router.patch(
  '/admin/:productId/badges',
  authMiddleware,
  authorize(['admin']),
  updateBadgesValidation,
  controller.updateBadges.bind(controller)
)

// ── Variations ────────────────────────────────────────────────────────────────

// list is public — buyers pick a variation on the product page
router.get(
  '/:productId/variations',
  checkIntegerParam('productId'),
  variationController.listVariations.bind(variationController)
)

// images[] may be attached — each is uploaded to S3 with a generated thumbnail
router.post(
  '/:productId/variations',
  authMiddleware,
  checkIntegerParam('productId'),
  fileController.handleMulterError(uploadVariationImages),
  variationController.createVariation.bind(variationController)
)

router.put(
  '/:productId/variations/:variationId',
  authMiddleware,
  checkIntegerParam('productId'),
  checkIntegerParam('variationId'),
  fileController.handleMulterError(uploadVariationImages),
  variationController.updateVariation.bind(variationController)
)

router.delete(
  '/:productId/variations/:variationId',
  authMiddleware,
  checkIntegerParam('productId'),
  checkIntegerParam('variationId'),
  variationController.deleteVariation.bind(variationController)
)

// ── Add-ons ───────────────────────────────────────────────────────────────────
// Mutually exclusive scoping: a non-variation product's add-ons live under
// /:productId/add-ons; a variation product's add-ons live per-variation under
// /:productId/variations/:variationId/add-ons. Lists are public — buyers see
// add-on choices on the product page.

router.get(
  '/:productId/add-ons',
  checkIntegerParam('productId'),
  addOnController.listProductAddOns.bind(addOnController)
)

// images[] may be attached — each is uploaded to S3 with a generated thumbnail
router.post(
  '/:productId/add-ons',
  authMiddleware,
  checkIntegerParam('productId'),
  fileController.handleMulterError(uploadAddOnImages),
  addOnController.createProductAddOn.bind(addOnController)
)

router.get(
  '/:productId/variations/:variationId/add-ons',
  checkIntegerParam('productId'),
  checkIntegerParam('variationId'),
  addOnController.listVariationAddOns.bind(addOnController)
)

router.post(
  '/:productId/variations/:variationId/add-ons',
  authMiddleware,
  checkIntegerParam('productId'),
  checkIntegerParam('variationId'),
  fileController.handleMulterError(uploadAddOnImages),
  addOnController.createVariationAddOn.bind(addOnController)
)

router.put(
  '/add-ons/:addOnId',
  authMiddleware,
  checkIntegerParam('addOnId'),
  fileController.handleMulterError(uploadAddOnImages),
  addOnController.updateAddOn.bind(addOnController)
)

router.delete(
  '/add-ons/:addOnId',
  authMiddleware,
  checkIntegerParam('addOnId'),
  addOnController.deleteAddOn.bind(addOnController)
)

router.delete(
  '/add-ons/images/:imageId',
  authMiddleware,
  checkIntegerParam('imageId'),
  addOnController.deleteAddOnImage.bind(addOnController)
)

// ── Categories ────────────────────────────────────────────────────────────────

// list is public — buyers see the product's categories
router.get(
  '/:productId/categories',
  checkIntegerParam('productId'),
  controller.listCategories.bind(controller)
)

router.post(
  '/:productId/categories',
  authMiddleware,
  assignCategoriesValidation,
  controller.addCategories.bind(controller)
)

router.delete(
  '/:productId/categories/:categoryId',
  authMiddleware,
  checkIntegerParam('productId'),
  checkIntegerParam('categoryId'),
  controller.removeCategory.bind(controller)
)

// ── Quantity discount rules (product-scoped) ──────────────────────────────────

// list is public — buyers see "Buy 3+ and save 5%" tiers
router.get(
  '/:productId/discount-rules',
  checkIntegerParam('productId'),
  discountController.listRules.bind(discountController)
)

router.post(
  '/:productId/discount-rules',
  authMiddleware,
  checkIntegerParam('productId'),
  discountController.createRule.bind(discountController)
)

// Public price preview — exactly one discount applies (code wins, else best qty rule)
router.get(
  '/:productId/price-preview',
  checkIntegerParam('productId'),
  discountController.previewPrice.bind(discountController)
)

// ── Product-scoped discounts ──────────────────────────────────────────────────

router.post(
  '/:productId/discounts',
  authMiddleware,
  checkIntegerParam('productId'),
  discountController.createDiscount.bind(discountController)
)

router.get(
  '/:productId/discounts',
  authMiddleware,
  checkIntegerParam('productId'),
  discountController.listDiscounts.bind(discountController)
)

// ── Single product (keep last so literal routes above win) ────────────────────

router.get(
  '/:productId',
  authMiddleware,
  getProductValidation,
  controller.getProductById.bind(controller)
)

module.exports = router
