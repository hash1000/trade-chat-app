const express = require('express');
const router = express.Router();
const ReceiptController = require('../controllers/ReceiptController');
const authenticate = require('../middlewares/authenticate');
const { createReceiptValidation, updateReceiptValidation, idParamValidation } = require('../middlewares/receiptValidation');

const receiptController = new ReceiptController();

router.get('/', authenticate, receiptController.getReceipts);
router.get('/:id', authenticate, idParamValidation, receiptController.getReceiptById);
router.post('/', authenticate, createReceiptValidation, receiptController.createReceipt);
router.put('/:id', authenticate, updateReceiptValidation, receiptController.updateReceipt);
router.delete('/:id', authenticate, idParamValidation, receiptController.deleteReceipt);

module.exports = router;
