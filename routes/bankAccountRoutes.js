const express = require('express');
const router = express.Router();
const BankAccountController = require('../controllers/BankAccountController');
const authenticate = require('../middlewares/authenticate');

const bankAccountController = new BankAccountController();

// CRUD routes
router.get('/', authenticate, bankAccountController.getBankAccounts);
router.get('/:id', authenticate, bankAccountController.getBankAccountById);
router.post('/', authenticate, bankAccountController.createBankAccount);
router.put('/:id', authenticate, bankAccountController.updateBankAccount);
router.delete('/:id', authenticate, bankAccountController.deleteBankAccount);
router.put('/:id/reorder', authenticate, bankAccountController.reorderBankAccount);

module.exports = router;
