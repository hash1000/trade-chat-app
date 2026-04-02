const BankAccountService = require("../services/BankAccountService");
const bankAccountService = new BankAccountService();

function handleBankAccountError(res, error) {
  console.error(error);

  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(400).json({ error: "IBAN already exists" });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  return res.status(500).json({ error: "Server Error" });
}

class BankAccountController {
  // Get all bank accounts for the logged-in user
  async getBankAccounts(req, res) {
    try {
      const { id: userId } = req.user;
      // Optional classification filter: sender | receiver | both | all
      const classification = req.query.classification;
      const accounts = await bankAccountService.getBankAccountsByUserId(
        userId,
        classification,
      );
      res.json(bankAccountService.serializeBankAccounts(accounts));
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }

  // Get specific account by ID
  async getBankAccountById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const account = await bankAccountService.getBankAccountById(userId, id);

      if (!account) return res.status(404).json({ error: "Account not found" });

      res.json(bankAccountService.serializeBankAccount(account));
    } catch (error) {
      handleBankAccountError(res, error);
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
        classification,
        currency,
      } = req.body;

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
        classification,
        currency,
      });

      res.status(201).json(bankAccountService.serializeBankAccount(newAccount));
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }

  // Update bank account
  async updateBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const updatedAccount = await bankAccountService.updateBankAccount(
        userId,
        id,
        updateData,
      );
      if (!updatedAccount)
        return res.status(404).json({ error: "Account not found" });

      res.json(bankAccountService.serializeBankAccount(updatedAccount));
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }

  // Delete bank account
  async deleteBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;

      const result = await bankAccountService.deleteBankAccount(userId, id);
      if (!result) return res.status(404).json({ error: "Account not found" });

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }

  // Reorder bank accounts
  async reorderBankAccount(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const { newPosition } = req.body;

      if (!newPosition || newPosition < 1) {
        return res.status(400).json({ error: "Valid newPosition is required" });
      }

      const reorderedAccounts = await bankAccountService.reorderBankAccount(
        userId,
        id,
        newPosition,
      );
      if (!reorderedAccounts)
        return res.status(404).json({ error: "Account not found" });

      res.json(bankAccountService.serializeBankAccounts(reorderedAccounts));
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }

  async getTestCards(req, res) {
    try {
    console.log("getTestCards",req.query.currency);
      const cards = await bankAccountService.getTestCards(req.query.currency);
      res.json({
        success: true,
        message: "Test cards retrieved successfully",
        data: bankAccountService.serializeBankAccounts(cards),
      });
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }

  async getTestCardByCurrency(req, res) {
    try {
      const { currency } = req.params;
      const card = await bankAccountService.getTestCardByCurrency(currency);

      if (!card || !card.length) {
        return res.status(404).json({ error: "Test card not found" });
      }

      res.json({
        success: true,
        message: "Test card retrieved successfully",
        data: bankAccountService.serializeBankAccounts(card),
      });
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }


  async updateAdminTestCard(req, res) {
    try {
      const { id } = req.params;
      const updatedCard = await bankAccountService.updateAdminTestCard(
        id,
        req.body,
      );

      if (!updatedCard) {
        return res.status(404).json({ error: "Account not found" });
      }

      res.json(bankAccountService.serializeBankAccount(updatedCard));
    } catch (error) {
      handleBankAccountError(res, error);
    }
  }
}

module.exports = BankAccountController;
