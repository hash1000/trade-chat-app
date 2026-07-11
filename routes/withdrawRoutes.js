const express = require('express');
const router = express.Router();
const WithdrawController = require('../controllers/WithdrawController');
const authenticate = require('../middlewares/authenticate');
const authMiddleware = require("../middlewares/authenticate");
const { createWithdrawValidation, payWithdrawValidation, refundWithdrawValidation, idParamValidation, getValidation, bulkDeleteValidation } = require('../middlewares/withdrawValidation');
const authorize = require('../middlewares/authorization');
const checkIntegerParam = require('../middlewares/paramIntegerValidation');

const withdrawController = new WithdrawController();

// user routes (no update/delete: the amount is already deducted at creation,
// only admin can act on a request afterwards)
router.get('/my', authenticate, getValidation, withdrawController.getWithdraws);
router.get('/my/:id', authenticate, idParamValidation, withdrawController.getWithdrawById);
router.post('/my', authenticate, createWithdrawValidation, withdrawController.createWithdraw);

// admin routes: paid or refund (final states, no lock/convert for withdraws)
router.put('/:id/paid', authMiddleware, authorize(["admin", "accountant"]), checkIntegerParam("id"), payWithdrawValidation, withdrawController.payWithdraw);
router.put('/:id/refund', authMiddleware, authorize(["admin", "accountant"]), checkIntegerParam("id"), refundWithdrawValidation, withdrawController.refundWithdraw);
// soft delete: pending withdraws are auto-refunded before deletion
router.delete('/bulk', authMiddleware, authorize(["admin"]), bulkDeleteValidation, withdrawController.adminBulkDeleteWithdraws);
router.delete('/:id', authMiddleware, authorize(["admin"]), checkIntegerParam("id"), withdrawController.adminDeleteWithdraw);
router.get('/', authMiddleware, authorize(["admin", "accountant"]), getValidation, withdrawController.getAdminWithdraws);

module.exports = router;
