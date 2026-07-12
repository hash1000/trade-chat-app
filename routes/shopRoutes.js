const express = require('express')
const router = express.Router()

const ShopController = require('../controllers/ShopController')
const authMiddleware = require('../middlewares/authenticate')
const checkIntegerParam = require('../middlewares/paramIntegerValidation')
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

router.post(
  '/', authMiddleware, createShopValidationRules, shopController.createShop.bind(shopController)
)
router.put(
  '/:shopId', authMiddleware, checkIntegerParam('shopId'), updateShopValidationRules, shopController.updateShop.bind(shopController)
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
