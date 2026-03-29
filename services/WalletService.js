const { Op } = require("sequelize");
const { User, Transaction } = require("../models");
const sequelize = require("../config/database");
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();
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

  async createDefaultWalletsForUser(userId) {
    const currencies = ["CNY", "USD", "EUR"];
    const wallets = [];

    for (const currency of currencies) {
      const wallet = await this.getOrCreateWallet(userId, currency, "PERSONAL");
      wallets.push(wallet);
    }

    return wallets;
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
      performedBy = null,
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
        performedBy: performedBy != null ? Number(performedBy) : null,
      },
      { transaction },
    );
  }

  /**
   * Wallet rows tied to FX conversion (USD→CNY etc.): no receipt, type IN/OUT only.
   */
  async listFxConvertWalletTransactions({ userId, page = 1, limit = 20 } = {}) {
    const uid = Number(userId);
    if (Number.isNaN(uid) || uid <= 0) {
      throw new Error("userId is required");
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const where = {
      userId: uid,
      receiptId: null,
      type: { [Op.in]: ["FX_CONVERT_IN", "FX_CONVERT_OUT"] },
    };

    const { rows, count } = await WalletTransaction.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset,
    });

    return {
      data: rows,
      total: count,
      page: pageNum,
      limit: limitNum,
    };
  }

  async deposit({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
    performedBy = null,
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
          performedBy,
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
    performedBy = null,
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
          performedBy,
        },
        t,
      );

      return wallet;
    });
  }

  /**
   * Move amount from lockedBalance to availableBalance on one wallet (same currency).
   * For admin/accountant manual unlock (not receipt cross-currency flow).
   */
  async unlockLockedToAvailable({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    meta = {},
    performedBy = null,
  }) {
    return sequelize.transaction(async (t) => {
      const wallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const locked = Number(wallet.lockedBalance) || 0;
      const unlockAmount = Number(amount);

      if (!unlockAmount || Number.isNaN(unlockAmount) || unlockAmount <= 0) {
        throw new Error("Invalid amount");
      }
      if (locked < unlockAmount) {
        throw new Error("Insufficient locked balance");
      }

      const beforeAvailable = Number(wallet.availableBalance) || 0;
      const beforeLocked = locked;
      const afterLocked = beforeLocked - unlockAmount;
      const afterAvailable = beforeAvailable + unlockAmount;

      wallet.lockedBalance = afterLocked;
      wallet.availableBalance = afterAvailable;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: wallet.id,
          userId,
          type: "UNLOCK",
          amount: unlockAmount,
          currency,
          balanceBefore: beforeAvailable,
          balanceAfter: afterAvailable,
          receiptId: null,
          meta: {
            ...meta,
            lockedBefore: beforeLocked,
            lockedAfter: afterLocked,
          },
          performedBy,
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
    performedBy = null,
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
          performedBy,
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
    performedBy = null,
  }) {
    return sequelize.transaction(async (t) => {
      const receipt = await Receipt.findOne({
        where: { id: receiptId },
        transaction: t,
      });

      // 1. Get the receipt-currency wallet (where the lock actually is) and subtract from lockedBalance
      const receiptCurrencyWallet = await this.getOrCreateWallet(
        userId,
        receiptCurrency,
        walletType,
        t,
      );

      const lockedInReceiptCurrency = Number(receiptCurrencyWallet.lockedBalance) || 0;
      const amountToUnlockNum = Number(amountToUnlock);

      if (lockedInReceiptCurrency < amountToUnlockNum) {
        throw new Error("Insufficient locked balance");
      }

      const afterLocked = lockedInReceiptCurrency - amountToUnlockNum;
      receiptCurrencyWallet.lockedBalance = afterLocked;

      // 2. Add to availableBalance: same wallet if same currency, else target-currency wallet
      // Same currency: use amountToUnlock (no conversion). Different: use amount (converted).
      const amountToAddToAvailable =
        currency === receiptCurrency
          ? amountToUnlockNum
          : Number(amount);

      if (currency === receiptCurrency) {
        // Same currency: add to same wallet's availableBalance
        const beforeAvailable = Number(receiptCurrencyWallet.availableBalance) || 0;
        receiptCurrencyWallet.availableBalance = beforeAvailable + amountToAddToAvailable;
        await receiptCurrencyWallet.save({ transaction: t });

        await this.createWalletTransaction(
          {
            walletId: receiptCurrencyWallet.id,
            userId,
            type: "UNLOCK",
            amount: amountToAddToAvailable,
            currency: receiptCurrency,
            balanceBefore: beforeAvailable,
            balanceAfter: beforeAvailable + amountToAddToAvailable,
            receiptId,
            meta: {
              ...meta,
              lockedBefore: lockedInReceiptCurrency,
              lockedAfter: afterLocked,
            },
            performedBy,
          },
          t,
        );

        return receiptCurrencyWallet;
      }

      // Different currency: subtract locked on receipt-currency wallet, add available on target wallet
      await receiptCurrencyWallet.save({ transaction: t });

      const targetWallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const beforeAvailable = Number(targetWallet.availableBalance) || 0;
      const afterAvailable = beforeAvailable + amountToAddToAvailable;
      targetWallet.availableBalance = afterAvailable;
      await targetWallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          walletId: targetWallet.id,
          userId,
          type: "UNLOCK",
          amount: amountToAddToAvailable,
          currency,
          balanceBefore: beforeAvailable,
          balanceAfter: afterAvailable,
          receiptId,
          meta: {
            ...meta,
            lockedBefore: lockedInReceiptCurrency,
            lockedAfter: afterLocked,
            receiptCurrency,
          },
          performedBy,
        },
        t,
      );

      return targetWallet;
    });
  }

  /**
   * Convert from one currency wallet to another (e.g. EUR → CNY).
   * Deducts amountInSource from fromCurrency wallet and credits (amountInSource / rate) to toCurrency wallet.
   * @param {Object} params
   * @param {number} params.userId
   * @param {string} params.fromCurrency - e.g. "EUR"
   * @param {string} params.toCurrency - e.g. "CNY"
   * @param {number} params.amountInSource - amount to deduct from fromCurrency (e.g. 10 EUR)
   * @param {number} params.rate - rate: target amount = amountInSource / rate (e.g. rate 2 → 10 EUR gives 5 CNY)
   * @param {string} params.walletType - default "PERSONAL"
   */
  async fxConvert({
    userId,
    fromCurrency = "USD",
    toCurrency,
    amountInSource,
    rate,
    walletType = "PERSONAL",
    meta = {},
  }) {
    const amountFrom = Number(amountInSource);
    const r = Number(rate);
    if (!amountFrom || amountFrom <= 0 || !r || r <= 0) {
      throw new Error("Invalid amount or rate");
    }
    const amountTarget = amountFrom / r;

    return sequelize.transaction(async (t) => {
      const fromWallet = await this.getOrCreateWallet(
        userId,
        fromCurrency,
        walletType,
        t,
      );
      console.log("fromWallet", fromWallet);
      const toWallet = await this.getOrCreateWallet(
        userId,
        toCurrency,
        walletType,
        t,
      );
      console.log("toWallet", toWallet);
      const fromAvailable = Number(fromWallet.availableBalance) || 0;
      console.log("fromAvailable", fromAvailable, amountFrom);
      console.log("amountTarget", amountTarget);
      if (fromAvailable < amountTarget) {
        console.log("Insufficient funds in source currency");
        throw new Error("Insufficient funds in source currency");
      }

      const fromBefore = fromAvailable;
      const fromAfter = fromBefore - amountTarget;
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
      const toAfter = toBefore + amountFrom;
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
          meta: { ...meta, fromCurrency, amountInSource: amountFrom, rate: r },
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
