const express = require('express')
const router = express.Router()

const PaymentController = require('../controllers/PaymentController')
const authMiddleware = require('../middlewares/authenticate')
const {
  createPaymentValidator,
  updatePaymentValidator
} = require('../middlewares/paymentValidation')

const paymentController = new PaymentController()

router.post('/', authMiddleware, createPaymentValidator, paymentController.createPayment.bind(paymentController))
router.put('/:id', authMiddleware, updatePaymentValidator, paymentController.updatePayment.bind(paymentController))
router.post('/:id/confirm', authMiddleware, paymentController.confirmPayment.bind(paymentController))
router.delete('/:id', authMiddleware, paymentController.deletePayment.bind(paymentController))
router.get('/', authMiddleware, paymentController.getUserPayments.bind(paymentController))
router.get('/cards', authMiddleware, paymentController.getUserCards.bind(paymentController))
router.post('/cards', authMiddleware, paymentController.addUserCard.bind(paymentController))
router.delete('/cards/:id', authMiddleware, paymentController.deleteUserCard.bind(paymentController))
router.put('/favourite/:id', authMiddleware, paymentController.favouritePayment.bind(paymentController))
router.put('/unfavourite/:id', authMiddleware, paymentController.unfavouritePayment.bind(paymentController))


module.exports = router
