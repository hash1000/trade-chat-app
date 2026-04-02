const BankAccountRepository = require("../repositories/BankAccountRepository");
const BankAccount = require("../models/bankAccount");

const TEST_CARD_CURRENCIES = ["EUR", "USD"];
const MAX_TEST_CARD_COUNT = TEST_CARD_CURRENCIES.length;

class BankAccountService {
  constructor() {
    this.bankAccountRepository = new BankAccountRepository();
  }

  normalizeCurrency(value) {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    return String(value).trim().toUpperCase();
  }

  assertValidCurrency(currency) {
    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
      const error = new Error(
        "currency must be a 3-letter code like USD or EUR",
      );
      error.statusCode = 422;
      throw error;
    }
  }

  assertSupportedTestCardCurrency(currency) {
    if (!TEST_CARD_CURRENCIES.includes(currency)) {
      const error = new Error("test card currency must be USD or EUR");
      error.statusCode = 422;
      throw error;
    }
  }

  normalizeTestCardCurrencies(value, options = {}) {
    const { allowEmpty = false } = options;

    if (value === undefined) {
      return [];
    }

    if (value === null || value === "") {
      if (allowEmpty) {
        return [];
      }

      const error = new Error("test card currency is required");
      error.statusCode = 422;
      throw error;
    }

    let rawValues;

    if (Array.isArray(value)) {
      rawValues = value;
    } else {
      const normalizedValue = String(value).trim();

      if (normalizedValue.startsWith("[")) {
        try {
          const parsedValue = JSON.parse(normalizedValue);

          if (!Array.isArray(parsedValue)) {
            throw new Error("Test card currency must be an array");
          }

          rawValues = parsedValue;
        } catch (error) {
          const parseError = new Error(
            "test card currency must be a valid array string",
          );
          parseError.statusCode = 422;
          throw parseError;
        }
      } else {
        rawValues = normalizedValue
          .split(/[\s,/]+/)
          .filter(Boolean);
      }
    }

    const normalizedCurrencies = [...new Set(
      rawValues
        .map((entry) => this.normalizeCurrency(entry))
        .filter(Boolean),
    )];

    if (!normalizedCurrencies.length && allowEmpty) {
      return [];
    }

    if (!normalizedCurrencies.length) {
      const error = new Error("test card currency is required");
      error.statusCode = 422;
      throw error;
    }

    if (normalizedCurrencies.length > TEST_CARD_CURRENCIES.length) {
      const error = new Error("test card can only use USD and EUR");
      error.statusCode = 422;
      throw error;
    }

    normalizedCurrencies.forEach((currency) =>
      this.assertSupportedTestCardCurrency(currency),
    );

    return TEST_CARD_CURRENCIES.filter((currency) =>
      normalizedCurrencies.includes(currency),
    );
  }

  hasTestCardCurrencyInput(data) {
    return (
      Object.prototype.hasOwnProperty.call(data, "currency") ||
      Object.prototype.hasOwnProperty.call(data, "accountCurrency")
    );
  }

  getRequestedTestCardCurrencies(data, options = {}) {
    const {
      allowEmpty = false,
      fallback = [],
      requireInput = false,
    } = options;

    if (!this.hasTestCardCurrencyInput(data)) {
      if (requireInput) {
        const error = new Error("test card currency is required");
        error.statusCode = 422;
        throw error;
      }

      return fallback;
    }

    const rawValue = Object.prototype.hasOwnProperty.call(data, "currency")
      ? data.currency
      : data.accountCurrency;

    return this.normalizeTestCardCurrencies(rawValue, { allowEmpty });
  }

  getRequestedAdminTestCardCurrencies(data, options = {}) {
    const {
      allowEmpty = false,
      fallback = [],
      requireInput = false,
    } = options;

    if (!Object.prototype.hasOwnProperty.call(data, "currency")) {
      if (requireInput) {
        const error = new Error("test card currency is required");
        error.statusCode = 422;
        throw error;
      }

      return fallback;
    }

    return this.normalizeTestCardCurrencies(data.currency, { allowEmpty });
  }

  getTestCardCurrenciesFromAccount(account) {
    if (!account) {
      return [];
    }

    const serializedCurrencies =
      account.accountCurrency ?? account.currency;

    return this.normalizeTestCardCurrencies(serializedCurrencies, {
      allowEmpty: true,
    });
  }

  serializeTestCardCurrencies(currencies) {
    return currencies.length ? JSON.stringify(currencies) : null;
  }

  getLegacyTestCardCurrency(currencies) {
    if (!currencies.length || currencies.length > 1) {
      return null;
    }

    return currencies[0];
  }

  buildTestCardCurrencyFields(currencies) {
    const serializedCurrencies = this.serializeTestCardCurrencies(currencies);

    return {
      currency: this.getLegacyTestCardCurrency(currencies),
      accountCurrency: serializedCurrencies,
    };
  }

  serializeBankAccount(account) {
    if (!account) {
      return account;
    }

    const plainAccount =
      typeof account.get === "function"
        ? account.get({ plain: true })
        : { ...account };

    if (!plainAccount.testCard) {
      return plainAccount;
    }

    return {
      ...plainAccount,
      currency: this.getTestCardCurrenciesFromAccount(plainAccount),
      accountCurrency: null,
    };
  }

  serializeBankAccounts(accounts) {
    if (!Array.isArray(accounts)) {
      return [];
    }

    return accounts.map((account) => this.serializeBankAccount(account));
  }

  async reassignCurrenciesFromOtherTestCards(
    assignedCurrencies,
    excludeAccountId = null,
    transaction,
  ) {
    const allTestCards = await this.bankAccountRepository.getAllTestCards({
      transaction,
    });

    for (const card of allTestCards) {
      if (excludeAccountId && card.id === excludeAccountId) {
        continue;
      }

      const currentCurrencies = this.getTestCardCurrenciesFromAccount(card);
      const remainingCurrencies = currentCurrencies.filter(
        (currency) => !assignedCurrencies.includes(currency),
      );

      if (remainingCurrencies.length === currentCurrencies.length) {
        continue;
      }

      await this.bankAccountRepository.updateAnyBankAccount(
        card.id,
        this.buildTestCardCurrencyFields(remainingCurrencies),
        { transaction },
      );
    }
  }

  async getBankAccountsByUserId(userId, classification) {
    return this.bankAccountRepository.getBankAccountsByUserId(
      userId,
      classification,
    );
  }

  async getBankAccountById(userId, accountId) {
    return this.bankAccountRepository.getBankAccountById(userId, accountId);
  }

  async createBankAccount(userId, accountData) {

    return this.bankAccountRepository.createBankAccount(userId, accountData);
  }

  async updateBankAccount(userId, accountId, updateData) {
    const safeUpdateData = { ...updateData };

    return this.bankAccountRepository.updateBankAccount(
      userId,
      accountId,
      safeUpdateData,
    );
  }

  async getTestCards(currency) {
    const cards = await this.bankAccountRepository.getAllTestCards();

    if (!currency) {
      return cards;
    }

    const normalizedCurrency = this.normalizeCurrency(currency);
    this.assertValidCurrency(normalizedCurrency);

    return cards.filter((card) =>
      this.getTestCardCurrenciesFromAccount(card).includes(normalizedCurrency),
    );
  }

  async getTestCardByCurrency(currency) {
    const normalizedCurrency = this.normalizeCurrency(currency);
    this.assertValidCurrency(normalizedCurrency);

    return this.getTestCards(normalizedCurrency);
  }

  async createAdminTestCard(userId, accountData) {
    const requestedCurrencies = this.getRequestedAdminTestCardCurrencies(
      accountData,
      { allowEmpty: false, requireInput: true },
    );

    return BankAccount.sequelize.transaction(async (transaction) => {
      const existingTestCards = await this.bankAccountRepository.getAllTestCards(
        { transaction },
      );

      if (existingTestCards.length >= MAX_TEST_CARD_COUNT) {
        const error = new Error("Only two admin test cards are allowed");
        error.statusCode = 409;
        throw error;
      }

      await this.reassignCurrenciesFromOtherTestCards(
        requestedCurrencies,
        null,
        transaction,
      );

      return this.bankAccountRepository.createBankAccount(userId, {
        ...accountData,
        ...this.buildTestCardCurrencyFields(requestedCurrencies),
        testCard: true,
      }, { transaction });
    });
  }

  async updateAdminTestCard(accountId, updateData) {
    const existingAccount =
      await this.bankAccountRepository.getAnyBankAccountById(accountId);

    if (!existingAccount) {
      return null;
    }

    if (!existingAccount.testCard) {
      const error = new Error("Test card not found");
      error.statusCode = 404;
      throw error;
    }

    const nextTestCard =
      typeof updateData.testCard === "boolean"
        ? updateData.testCard
        : existingAccount.testCard;

    const nextCurrencies = this.getRequestedAdminTestCardCurrencies(updateData, {
      allowEmpty: true,
      fallback: this.getTestCardCurrenciesFromAccount(existingAccount),
    });

    return BankAccount.sequelize.transaction(async (transaction) => {
      const safeUpdateData = {};

      if (typeof updateData.testCard === "boolean") {
        safeUpdateData.testCard = updateData.testCard;
      }

      if (nextTestCard) {
        await this.reassignCurrenciesFromOtherTestCards(
          nextCurrencies,
          existingAccount.id,
          transaction,
        );

        Object.assign(
          safeUpdateData,
          this.buildTestCardCurrencyFields(nextCurrencies),
        );
      }

      return this.bankAccountRepository.updateAnyBankAccount(
        accountId,
        safeUpdateData,
        { transaction },
      );
    });
  }

  async deleteBankAccount(userId, accountId) {
    return this.bankAccountRepository.deleteBankAccount(userId, accountId);
  }

  async reorderBankAccount(userId, accountId, newPosition) {
    return this.bankAccountRepository.reorderBankAccount(
      userId,
      accountId,
      newPosition,
    );
  }
}

module.exports = BankAccountService;
