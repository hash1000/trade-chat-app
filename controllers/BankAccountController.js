const BankAccountService = require('../services/BankAccountService');
const bankAccountService = new BankAccountService();

class BankAccountController {
  // Get all bank accounts for the logged-in user
  async getBankAccounts(req, res) {
    try {
      const { id: userId } = req.user;
      // Optional classification filter: sender | receiver | both | all
      const classification = req.query.classification;
      const accounts = await bankAccountService.getBankAccountsByUserId(userId, classification);
      res.json(accounts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // Get specific account by ID
  async getBankAccountById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const account = await bankAccountService.getBankAccountById(userId, id);

      if (!account) return res.status(404).json({ error: 'Account not found' });

      res.json(account);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // Create new bank account
  async createBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { 
        accountName, 
        iban, 
        accountHolder, 
        accountCurrency, 
        bic,
        swift_code,
        intermediateBank, 
        note,
        beneficiaryAddress,
        classification
      } = req.body;
      console.log('Creating bank account with data:', req.body);

      const newAccount = await bankAccountService.createBankAccount(userId, {
        accountName,
        iban,
        accountHolder,
        accountCurrency,
        bic,
        swift_code,
        note,
        intermediateBank,
        beneficiaryAddress,
        classification
      });

      res.status(201).json(newAccount);
    } catch (error) {
      console.error(error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'IBAN already exists' });
      }
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // Update bank account
  async updateBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const updatedAccount = await bankAccountService.updateBankAccount(userId, id, updateData);
      if (!updatedAccount) return res.status(404).json({ error: 'Account not found' });

      res.json(updatedAccount);
    } catch (error) {
      console.error(error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ error: 'IBAN already exists' });
      }
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // Delete bank account
  async deleteBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;

      const result = await bankAccountService.deleteBankAccount(userId, id);
      if (!result) return res.status(404).json({ error: 'Account not found' });

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  // Reorder bank accounts
  async reorderBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const { newPosition } = req.body;

      if (!newPosition || newPosition < 1) {
        return res.status(400).json({ error: 'Valid newPosition is required' });
      }

      const reorderedAccounts = await bankAccountService.reorderBankAccount(userId, id, newPosition);
      if (!reorderedAccounts) return res.status(404).json({ error: 'Account not found' });

      res.json(reorderedAccounts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }
}

module.exports = BankAccountController;