const express = require('express')
const router = express.Router()

const InvoiceController = require('../controllers/InvoiceController')
const authMiddleware = require('../middlewares/authenticate')
const { createInvoiceValidator } = require('../middlewares/invoiceValidation')
const invoiceController = new InvoiceController()

// POST route to add an item to the cart
router.post('/', authMiddleware, createInvoiceValidator, invoiceController.createInvoice.bind(invoiceController))
router.put('/:id', authMiddleware, invoiceController.updateInvoice.bind(invoiceController))
router.get('/:id', authMiddleware, invoiceController.getInvoice.bind(invoiceController))
router.get('/', authMiddleware, invoiceController.getUserInvoices.bind(invoiceController))
router.delete('/:id', authMiddleware, invoiceController.deleteInvoice.bind(invoiceController))

module.exports = router
