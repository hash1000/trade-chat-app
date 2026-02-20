const BankAccountRepository = require('../repositories/BankAccountRepository');

class BankAccountService {
  constructor() {
    this.bankAccountRepository = new BankAccountRepository();
  }

  async getBankAccountsByUserId(userId, classification) {
    return this.bankAccountRepository.getBankAccountsByUserId(userId, classification);
  }

  async getBankAccountById(userId, accountId) {
    return this.bankAccountRepository.getBankAccountById(userId, accountId);
  }

  async createBankAccount(userId, accountData) {
    return this.bankAccountRepository.createBankAccount(userId, accountData);
  }

  async updateBankAccount(userId, accountId, updateData) {
    return this.bankAccountRepository.updateBankAccount(userId, accountId, updateData);
  }

  async deleteBankAccount(userId, accountId) {
    return this.bankAccountRepository.deleteBankAccount(userId, accountId);
  }

  async reorderBankAccount(userId, accountId, newPosition) {
    return this.bankAccountRepository.reorderBankAccount(userId, accountId, newPosition);
  }
}

module.exports = BankAccountService;
