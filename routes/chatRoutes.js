const express = require('express')
const router = express.Router()
const multer = require('multer')
// Configure multer storage
const storage = multer.memoryStorage()
const upload = multer({ storage })

const authMiddleware = require('../middlewares/authenticate')
const ChatController = require('../controllers/ChatController')
const chatController = new ChatController()

router.post('/request', authMiddleware, chatController.chatRequest.bind(chatController))
router.post('/:chatId/delete', authMiddleware, chatController.deleteChat.bind(chatController))
router.post('/', authMiddleware, chatController.getChats.bind(chatController))
router.get('/:chatId/messages', authMiddleware, chatController.getMessages.bind(chatController))
router.get('/transactions', authMiddleware, chatController.getUserTransactions.bind(chatController))

// route to send a payment request to a user
router.post('/request-payment', authMiddleware, chatController.sendPaymentRequest.bind(chatController))

// route to send a payment to a user
router.post('/create-payment', authMiddleware, chatController.sendPayment.bind(chatController))

router.post('/bulk-forward', authMiddleware, upload.array('files'), chatController.bulkForwardMessages.bind(chatController))

module.exports = router
