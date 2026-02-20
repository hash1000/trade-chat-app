const express = require('express');
const router = express.Router();
const BankAccountController = require('../controllers/BankAccountController');
const authenticate = require('../middlewares/authenticate');
const {createBankAccountValidation, updateBankAccountValidation, idParamValidation} = require('../middlewares/bankAccountValidation');

const bankAccountController = new BankAccountController();

// CRUD routes
router.get('/', authenticate, bankAccountController.getBankAccounts);
router.get('/:id', authenticate, idParamValidation, bankAccountController.getBankAccountById);
router.post('/', authenticate, createBankAccountValidation, bankAccountController.createBankAccount);
router.put('/:id', authenticate, updateBankAccountValidation, bankAccountController.updateBankAccount);
router.delete('/:id', authenticate, idParamValidation, bankAccountController.deleteBankAccount);
router.put('/:id/reorder', authenticate, idParamValidation, bankAccountController.reorderBankAccount);

module.exports = router;
