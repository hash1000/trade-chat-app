const express = require('express')
const router = express.Router()
const CardController = require('../controllers/CardController')
const cardController = new CardController()
const authMiddleware = require('../middleware/auth')

router.use(authMiddleware)

router.get('/', cardController.getCards)
router.get('/:id', cardController.getCardById)
router.post('/', cardController.createCard)
router.put('/:id', cardController.updateCard)
router.delete('/:id', cardController.deleteCard)
router.put('/:id/reorder', cardController.reorderCard)

module.exports = router