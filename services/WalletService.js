const { User, Transaction } = require("../models");
const sequelize = require("../config/database");
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();
const CurrencyService = require("./CurrencyService");
const currencyService = new CurrencyService();
const Wallet = require("../models/wallet");
const WalletTransaction = require("../models/walletTransaction");
const Receipt = require("../models/receipt");

class WalletService {
  constructor() {
    // If you later introduce a CurrencyRepository, initialize it here
  }
  async getUserWalletById(userId) {
    return User.findByPk(userId);
  }

  async updateCustomerId(user, customerId) {
    console.log("user,customerId", user, customerId);
    return await userRepository.update(user.id, {
      stripeCustomerId: customerId,
    });
  }

  async createTransaction(userId, amount, type, status, metadata = {}) {
    return Transaction.create({
      userId,
      amount,
      type,
      status,
      reference: `${type}-${Date.now()}`,
      metadata,
    });
  }

  async createWallet(userId, currency, walletType = "PERSONAL") {
    const [wallet, created] = await Wallet.findOrCreate({
      where: { userId, currency, walletType },
      defaults: { availableBalance: 0, lockedBalance: 0 },
    });
    return { wallet, created };
  }

  async getOrCreateWallet(
    userId,
    currency,
    walletType = "PERSONAL",
    transaction,
  ) {
    const [wallet] = await Wallet.findOrCreate({
      where: { userId, currency, walletType },
      defaults: { availableBalance: 0, lockedBalance: 0 },
      transaction,
    });
    return wallet;
  }

  async createWalletTransaction(
    {
      walletId,
      userId,
      type,
      amount,
      currency,
      balanceBefore = null,
      balanceAfter = null,
      receiptId = null,
      meta = {},
    },
    transaction,
  ) {
    return WalletTransaction.create(
      {
        walletId,
        userId,
        type,
        amount,
        currency,
        balanceBefore,
        balanceAfter,
        receiptId,
        meta,
      },
      { transaction },
    );
  }

  async deposit({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
  }) {
    return sequelize.transaction(async (t) => {
      const wallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const before = Number(wallet.availableBalance) || 0;
      const after = before + Number(amount);

      wallet.availableBalance = after;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: wallet.id,
          userId,
          type: "DEPOSIT",
          amount,
          currency,
          balanceBefore: before,
          balanceAfter: after,
          receiptId,
          meta,
        },
        t,
      );

      return wallet;
    });
  }

  async lockFunds({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
  }) {
    return sequelize.transaction(async (t) => {
      const wallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const available = Number(wallet.availableBalance) || 0;
      const lockAmount = Number(amount);

      if (available < lockAmount) {
        throw new Error("Insufficient available balance");
      }

      const beforeAvailable = available;
      const beforeLocked = Number(wallet.lockedBalance) || 0;

      const afterAvailable = beforeAvailable - lockAmount;
      const afterLocked = beforeLocked + lockAmount;
      wallet.availableBalance = afterAvailable;
      wallet.lockedBalance = afterLocked;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: wallet.id,
          userId,
          type: "LOCK",
          amount,
          currency,
          balanceBefore: beforeAvailable,
          balanceAfter: afterAvailable,
          receiptId,
          meta: {
            ...meta,
            lockedBefore: beforeLocked,
            lockedAfter: afterLocked,
          },
        },
        t,
      );

      return wallet;
    });
  }

  /**
   * Directly credit locked balance without touching available balance.
   * Use this for scenarios like admin-approved topups with isLock=true.
   */
  async creditLocked({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
  }) {
    return sequelize.transaction(async (t) => {
      const wallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const beforeLocked = Number(wallet.lockedBalance) || 0;
      const afterLocked = beforeLocked + Number(amount);

      wallet.lockedBalance = afterLocked;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: wallet.id,
          userId,
          type: "LOCK",
          amount,
          currency,
          balanceBefore: beforeLocked,
          balanceAfter: afterLocked,
          receiptId,
          meta,
        },
        t,
      );

      return wallet;
    });
  }

  async unlockFunds({
    userId,
    currency,
    amountToUnlock,
    receiptCurrency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
  }) {
    return sequelize.transaction(async (t) => {
      const wallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const receipt = await Receipt.findOne({
        where: { id: receiptId },
        transaction: t,
      });

      const locked = Number(wallet.lockedBalance) || 0;
      const unlockAmount = Number(amount);

      if (locked < unlockAmount) {
        throw new Error("Insufficient locked balance");
      }

      const beforeAvailable = Number(wallet.availableBalance) || 0;
      const beforeLocked = locked;

      const afterAvailable = beforeAvailable + unlockAmount;

      wallet.lockedBalance = beforeLocked; // It seems lockedBalance should remain the same
      wallet.availableBalance = afterAvailable;
      await wallet.save({ transaction: t });

      // Update the corresponding wallet for the receipt's currency
      const walletFind = await Wallet.findOne({
        where: { userId, currency: receiptCurrency },
        transaction: t,
      });

      // Adjust the locked balance of the wallet associated with the receipt's currency
      await Wallet.update(
        {
          lockedBalance: walletFind.lockedBalance - amountToUnlock,
        },
        { where: { userId, currency: receiptCurrency }, transaction: t },
      );
      
      await this.createWalletTransaction(
        {
          walletId: wallet.id,
          userId,
          type: "UNLOCK",
          amount,
          currency,
          balanceBefore: beforeAvailable,
          balanceAfter: afterAvailable,
          receiptId,
          meta: {
            ...meta,
            lockedBefore: beforeLocked,
            lockedAfter: beforeLocked,
          },
        },
        t,
      );

      return wallet;
    });
  }

  /**
   * Convert from one currency wallet to another (e.g. USD → CNY or USD → EUR).
   * Deducts from fromCurrency wallet and credits to toCurrency wallet; creates FX_CONVERT_OUT and FX_CONVERT_IN transactions.
   * @param {Object} params
   * @param {number} params.userId
   * @param {string} params.fromCurrency - e.g. "USD"
   * @param {string} params.toCurrency - e.g. "CNY" or "EUR"
   * @param {number} params.amountInTarget - amount to credit in toCurrency
   * @param {number} params.rate - rate from fromCurrency to target (e.g. 1 USD = rate CNY)
   * @param {string} params.walletType - default "PERSONAL"
   */
  async fxConvert({
    userId,
    fromCurrency = "USD",
    toCurrency,
    amountInTarget,
    rate,
    walletType = "PERSONAL",
    meta = {},
  }) {
    const amountTarget = Number(amountInTarget);
    const r = Number(rate);
    if (!amountTarget || amountTarget <= 0 || !r || r <= 0) {
      throw new Error("Invalid amount or rate");
    }
    const amountFrom = amountTarget / r;

    return sequelize.transaction(async (t) => {
      const fromWallet = await this.getOrCreateWallet(
        userId,
        fromCurrency,
        walletType,
        t,
      );
      const toWallet = await this.getOrCreateWallet(
        userId,
        toCurrency,
        walletType,
        t,
      );

      const fromAvailable = Number(fromWallet.availableBalance) || 0;
      if (fromAvailable < amountFrom) {
        throw new Error("Insufficient funds in source currency");
      }

      const fromBefore = fromAvailable;
      const fromAfter = fromBefore - amountFrom;
      fromWallet.availableBalance = fromAfter;
      await fromWallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: fromWallet.id,
          userId,
          type: "FX_CONVERT_OUT",
          amount: amountFrom,
          currency: fromCurrency,
          balanceBefore: fromBefore,
          balanceAfter: fromAfter,
          meta: { ...meta, toCurrency, amountInTarget: amountTarget, rate: r },
        },
        t,
      );

      const toBefore = Number(toWallet.availableBalance) || 0;
      const toAfter = toBefore + amountTarget;
      toWallet.availableBalance = toAfter;
      await toWallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: toWallet.id,
          userId,
          type: "FX_CONVERT_IN",
          amount: amountTarget,
          currency: toCurrency,
          balanceBefore: toBefore,
          balanceAfter: toAfter,
          meta: { ...meta, fromCurrency, amountFrom, rate: r },
        },
        t,
      );

      return {
        fromWallet,
        toWallet,
        amountFrom,
        amountInTarget: amountTarget,
        rate: r,
      };
    });
  }

  async creditUserWallet(userId, amount) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, { transaction });
      if (!user) throw new Error("User not found");

      const newBalance = user.personalWalletBalance + amount;
      await user.update({ personalWalletBalance: newBalance }, { transaction });

      await this.createTransaction(userId, amount, "topup", "completed");

      await transaction.commit();
      return user;
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async convertUsdToCny(userId, usdAmount, rate) {
    const transaction = await sequelize.transaction();
    try {
      if (!usdAmount || Number(usdAmount) <= 0) {
        throw new Error("Invalid amount to convert");
      }

      const user = await User.findByPk(userId, { transaction });
      if (!user) throw new Error("User not found");

      const currentUsdBalance = Number(user.usdWalletBalance) || 0;
      const convertAmount = Number(usdAmount);
      if (currentUsdBalance < convertAmount) {
        throw new Error("Insufficient USD wallet balance");
      }

      // Get current USD -> CNY rate
      // const rate = await currencyService.getCurrentRate('USD', 'CNY');
      const converted = convertAmount / Number(rate);

      // Update balances
      const newUsdBalance = currentUsdBalance - convertAmount;
      const newPersonalBalance =
        (Number(user.personalWalletBalance) || 0) + rate;

      await user.update(
        {
          usdWalletBalance: newUsdBalance,
          personalWalletBalance: newPersonalBalance,
        },
        { transaction },
      );

      // Create a transaction record for audit
      await Transaction.create(
        {
          orderId: `conversion-${Date.now()}`,
          userId: user.id,
          amount: rate,
          usdAmount: convertAmount,
          rate: Number(rate),
          currency: "CNY",
          type: "conversion",
          status: "completed",
          paymentMethod: "conversion",
          metadata: { note: "USD->CNY conversion" },
        },
        { transaction },
      );

      await transaction.commit();

      return {
        success: true,
        userId: user.id,
        usdDeducted: convertAmount,
        cnyAdded: rate,
        rate: Number(rate),
        balances: {
          usdWalletBalance: newUsdBalance,
          personalWalletBalance: newPersonalBalance,
        },
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = WalletService;
