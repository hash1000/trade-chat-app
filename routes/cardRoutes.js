const express = require('express')
const router = express.Router()
const CardController = require('../controllers/CardController')
const authenticate = require("../middlewares/authenticate");
const cardController = new CardController()


// router.get('/', authenticate, cardController.getCards)
router.get('/:id', authenticate, cardController.getCardById)
router.post('/', authenticate, cardController.createCard)
router.put('/:id', authenticate, cardController.updateCard)
router.delete('/:id', authenticate, cardController.deleteCard)
router.put('/:id/reorder', authenticate, cardController.reorderCard)

module.exports = router