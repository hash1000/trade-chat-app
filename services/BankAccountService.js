const BankAccountRepository = require('../repositories/BankAccountRepository');

const TEST_CARD_CURRENCIES = ['USD', 'EUR'];

class BankAccountService {
  constructor() {
    this.bankAccountRepository = new BankAccountRepository();
  }

  normalizeCurrency(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    return String(value).trim().toUpperCase();
  }

  assertValidCurrency(currency) {
    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      const error = new Error('currency must be a 3-letter code like USD or EUR');
      error.statusCode = 422;
      throw error;
    }
  }

  assertSupportedTestCardCurrency(currency) {
    if (!TEST_CARD_CURRENCIES.includes(currency)) {
      const error = new Error('test card currency must be USD or EUR');
      error.statusCode = 422;
      throw error;
    }
  }

  async ensureTestCardCurrencyIsAvailable(currency, excludeAccountId = null) {
    const existingTestCard = await this.bankAccountRepository.getTestCardByCurrency(
      currency,
      excludeAccountId,
    );

    if (existingTestCard) {
      const error = new Error(`A test card already exists for ${currency}`);
      error.statusCode = 409;
      throw error;
    }
  }

  async getBankAccountsByUserId(userId, classification) {
    return this.bankAccountRepository.getBankAccountsByUserId(userId, classification);
  }

  async getBankAccountById(userId, accountId) {
    return this.bankAccountRepository.getBankAccountById(userId, accountId);
  }

  async createBankAccount(userId, accountData) {
    const normalizedCurrency = this.normalizeCurrency(
      accountData.currency || accountData.accountCurrency,
    );

    this.assertValidCurrency(normalizedCurrency);

    return this.bankAccountRepository.createBankAccount(userId, {
      ...accountData,
      accountCurrency: accountData.accountCurrency || normalizedCurrency,
      currency: normalizedCurrency,
    });
  }

  async updateBankAccount(userId, accountId, updateData) {
    const safeUpdateData = { ...updateData };

    delete safeUpdateData.testCard;
    delete safeUpdateData.userId;
    delete safeUpdateData.sequence;

    if (safeUpdateData.currency !== undefined || safeUpdateData.accountCurrency !== undefined) {
      const normalizedCurrency = this.normalizeCurrency(
        safeUpdateData.currency || safeUpdateData.accountCurrency,
      );

      this.assertValidCurrency(normalizedCurrency);
      safeUpdateData.accountCurrency =
        safeUpdateData.accountCurrency || safeUpdateData.currency || normalizedCurrency;
      safeUpdateData.currency = normalizedCurrency;
    }

    return this.bankAccountRepository.updateBankAccount(userId, accountId, safeUpdateData);
  }

  async getTestCards(currency) {
    if (!currency) {
      return this.bankAccountRepository.getTestCards();
    }

    const normalizedCurrency = this.normalizeCurrency(currency);
    this.assertValidCurrency(normalizedCurrency);

    return this.bankAccountRepository.getTestCards(normalizedCurrency);
  }

  async getTestCardByCurrency(currency) {
    const normalizedCurrency = this.normalizeCurrency(currency);
    this.assertValidCurrency(normalizedCurrency);

    return this.bankAccountRepository.getTestCardByCurrency(normalizedCurrency);
  }

  async createAdminTestCard(userId, accountData) {
    const normalizedCurrency = this.normalizeCurrency(
      accountData.currency || accountData.accountCurrency,
    );

    this.assertValidCurrency(normalizedCurrency);
    this.assertSupportedTestCardCurrency(normalizedCurrency);
    await this.ensureTestCardCurrencyIsAvailable(normalizedCurrency);

    return this.bankAccountRepository.createBankAccount(userId, {
      ...accountData,
      accountCurrency: accountData.accountCurrency || normalizedCurrency,
      currency: normalizedCurrency,
      testCard: true,
    });
  }

  async updateAdminTestCard(accountId, updateData) {
    const existingAccount = await this.bankAccountRepository.getAnyBankAccountById(accountId);

    if (!existingAccount) {
      return null;
    }

    if (typeof updateData.testCard !== 'boolean') {
      const error = new Error('testCard must be true or false');
      error.statusCode = 422;
      throw error;
    }

    const safeUpdateData = {
      testCard: updateData.testCard,
    };

    const nextCurrency = this.normalizeCurrency(
      updateData.currency || updateData.accountCurrency || existingAccount.currency,
    );

    this.assertValidCurrency(nextCurrency);

    if (updateData.currency !== undefined || updateData.accountCurrency !== undefined) {
      safeUpdateData.currency = nextCurrency;
      safeUpdateData.accountCurrency =
        updateData.accountCurrency || updateData.currency || nextCurrency;
    }

    if (updateData.testCard) {
      this.assertSupportedTestCardCurrency(nextCurrency);
      await this.ensureTestCardCurrencyIsAvailable(nextCurrency, existingAccount.id);

      if (safeUpdateData.currency === undefined) {
        safeUpdateData.currency = nextCurrency;
      }

      if (safeUpdateData.accountCurrency === undefined) {
        safeUpdateData.accountCurrency = existingAccount.accountCurrency || nextCurrency;
      }
    }

    return this.bankAccountRepository.updateAnyBankAccount(accountId, safeUpdateData);
  }

  async deleteBankAccount(userId, accountId) {
    return this.bankAccountRepository.deleteBankAccount(userId, accountId);
  }

  async reorderBankAccount(userId, accountId, newPosition) {
    return this.bankAccountRepository.reorderBankAccount(userId, accountId, newPosition);
  }
}

module.exports = BankAccountService;
