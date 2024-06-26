const express = require('express')
const router = express.Router()
const authRoutes = require('./authRoutes')
const companyRoutes = require('./companyRoutes')
const productRoutes = require('./productRoutes')
const orderRoutes = require('./orderRoutes')
const paymentRoutes = require('./paymentRoutes')
const cartRoutes = require('./cartRoutes')
const invoiceRoutes = require('./invoiceRoutes')
const fileRoutes = require('./fileRoutes')
const chatRoutes = require('./chatRoutes')
const userRoutes = require('./userRoutes')

// Signup route
router.use('/auth', authRoutes)
router.use('/company', companyRoutes)
router.use('/product', productRoutes)
router.use('/order', orderRoutes)
router.use('/payment', paymentRoutes)
router.use('/cart', cartRoutes)
router.use('/invoice', invoiceRoutes)
router.use('/file', fileRoutes)
router.use('/chat', chatRoutes)
router.use('/user', userRoutes)

module.exports = router
