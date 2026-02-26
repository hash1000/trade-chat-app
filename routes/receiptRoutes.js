const express = require('express');
const router = express.Router();
const ReceiptController = require('../controllers/ReceiptController');
const authenticate = require('../middlewares/authenticate');
const authMiddleware = require("../middlewares/authenticate");
const { createReceiptValidation, updateReceiptValidation, idParamValidation, getValidation, adminUpdateValidation } = require('../middlewares/receiptValidation');
const authorize = require('../middlewares/authorization');
const checkIntegerParam = require('../middlewares/paramIntegerValidation');

const receiptController = new ReceiptController();

router.get('/my', authenticate, receiptController.getReceipts);
router.get('/my/:id', authenticate, idParamValidation, receiptController.getReceiptById);
router.post('/my', authenticate, createReceiptValidation, receiptController.createReceipt);
router.put('/my/:id', authenticate, updateReceiptValidation, receiptController.updateReceipt);
router.delete('/my/:id', authenticate, idParamValidation, receiptController.deleteReceipt);

// admin routes for approving or rejecting receipts
router.put('/:id/approve', authMiddleware, authorize(["admin", "accountant"]), receiptController.approveReceipt);
router.put('/:id/reject', authMiddleware, authorize(["admin", "accountant"]), checkIntegerParam("id"), receiptController.rejectReceipt);
router.put('/:id', authMiddleware, authorize(["admin","accountant"]), checkIntegerParam("id"), adminUpdateValidation, receiptController.adminUpdateReceipt);
router.get('/', authMiddleware, authorize(["admin", "accountant"]), getValidation, receiptController.getAdminReceipts);


module.exports = router;
