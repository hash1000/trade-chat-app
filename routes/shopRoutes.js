const express = require('express')
const router = express.Router()

const ShopController = require('../controllers/ShopController')
const authMiddleware = require('../middlewares/authenticate')
const checkIntegerParam = require('../middlewares/paramIntegerValidation')
const multerHandler = require('../middlewares/multerHandler')
const { uploadShopImages } = require('../utilities/shopFileMulter')
const {
  createShopValidationRules,
  updateShopValidationRules,
  getPaginatedShopsValidation,
  assignTeamsValidation,
  shopMembersValidation,
  setEditorValidation,
} = require('../middlewares/shopValidation')

const shopController = new ShopController()

// ── Core CRUD ─────────────────────────────────────────────────────────────────

// header_image / profile_image / multiple_images accept uploaded files, which
// are pushed to S3 with thumbnails, or plain URL strings as before.
const IMAGE_TOO_LARGE = 'Image exceeds the 25MB limit.'

router.post(
  '/', authMiddleware, multerHandler(uploadShopImages, IMAGE_TOO_LARGE), createShopValidationRules, shopController.createShop.bind(shopController)
)
router.put(
  '/:shopId', authMiddleware, multerHandler(uploadShopImages, IMAGE_TOO_LARGE), checkIntegerParam('shopId'), updateShopValidationRules, shopController.updateShop.bind(shopController)
)
router.delete('/:shopId', authMiddleware, checkIntegerParam('shopId'), shopController.deleteShop.bind(shopController))
router.get('/', authMiddleware, shopController.getShops.bind(shopController))

// Must be BEFORE /:id so "list" is not swallowed as an id value
router.get('/list', authMiddleware, getPaginatedShopsValidation, shopController.getPaginatedShops.bind(shopController))

// ── Teams ─────────────────────────────────────────────────────────────────────

router.post(
  '/:shopId/teams',
  authMiddleware,
  checkIntegerParam('shopId'),
  assignTeamsValidation,
  shopController.addTeams.bind(shopController)
)

router.delete(
  '/:shopId/teams/:teamId',
  authMiddleware,
  checkIntegerParam('shopId'),
  checkIntegerParam('teamId'),
  shopController.removeTeam.bind(shopController)
)

// ── Members ───────────────────────────────────────────────────────────────────

router.get(
  '/:shopId/members',
  authMiddleware,
  checkIntegerParam('shopId'),
  shopController.listMembers.bind(shopController)
)

router.post(
  '/:shopId/members',
  authMiddleware,
  checkIntegerParam('shopId'),
  shopMembersValidation,
  shopController.addMembers.bind(shopController)
)

router.delete(
  '/:shopId/members',
  authMiddleware,
  checkIntegerParam('shopId'),
  shopMembersValidation,
  shopController.removeMembers.bind(shopController)
)

// ── Editor ────────────────────────────────────────────────────────────────────

router.patch(
  '/:shopId/editor',
  authMiddleware,
  checkIntegerParam('shopId'),
  setEditorValidation,
  shopController.setEditor.bind(shopController)
)

router.delete(
  '/:shopId/editor',
  authMiddleware,
  checkIntegerParam('shopId'),
  shopController.clearEditor.bind(shopController)
)

// ── Single shop (keep last so literal routes above win) ───────────────────────

router.get('/:id', authMiddleware, checkIntegerParam('id'), shopController.getShopById.bind(shopController))

module.exports = router
