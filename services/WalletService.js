const { Op } = require("sequelize");
const { User, Transaction, Role } = require("../models");
const sequelize = require("../config/database");
const UserRepository = require("../repositories/UserRepository");
const crypto = require("crypto");
const userRepository = new UserRepository();
const Wallet = require("../models/wallet");
const WalletTransaction = require("../models/walletTransaction");
const Receipt = require("../models/receipt");
const { generateWalletAccountNumber } = require("../utilities/walletUtils");

class WalletService {
  constructor() {}

  _makeGroupId(explicitGroupId) {
    if (explicitGroupId != null && String(explicitGroupId).trim() !== "") {
      return String(explicitGroupId).trim();
    }
    return crypto.randomUUID();
  }

  /**
   * TRANSFER-only: per-currency income/expense amounts and transaction counts.
   * Always includes USD, EUR, CNY (zeros if no activity). Other currencies are appended when present.
   */
  _buildTransferIncomeExpenseSummary(transferRows) {
    const defaultCurrencies = ["USD", "EUR", "CNY"];
    const byCurrency = {};
    for (const c of defaultCurrencies) {
      byCurrency[c] = {
        income: 0,
        expense: 0,
        income_count: 0,
        expense_count: 0,
      };
    }

    const totals = {
      income_amount: 0,
      expense_amount: 0,
      income_count: 0,
      expense_count: 0,
    };

    for (const tx of transferRows) {
      if (tx.type && tx.type !== "TRANSFER") continue;

      const currency = String(tx.currency || "").toUpperCase();
      if (!currency) continue;

      if (!byCurrency[currency]) {
        byCurrency[currency] = {
          income: 0,
          expense: 0,
          income_count: 0,
          expense_count: 0,
        };
      }

      const amount = Number(tx.amount) || 0;
      if (amount > 0) {
        byCurrency[currency].income += amount;
        byCurrency[currency].income_count += 1;
        totals.income_amount += amount;
        totals.income_count += 1;
      } else if (amount < 0) {
        const abs = Math.abs(amount);
        byCurrency[currency].expense += abs;
        byCurrency[currency].expense_count += 1;
        totals.expense_amount += abs;
        totals.expense_count += 1;
      }
    }

    return { income_expense_by_currency: byCurrency, transfer_totals: totals };
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
    const Walletcurrency = {
      USD: "1",
      EUR: "2",
      CNY: "3",
    };

    // Check if the currency exists in the mapping
    if (!Walletcurrency[currency]) {
      console.log("Invalid currency:", currency);
      throw new Error("Currency not supported");
    }

    const accountNumber = generateWalletAccountNumber(Walletcurrency[currency]);
    console.log("accountNumber", accountNumber);

    const [wallet, created] = await Wallet.findOrCreate({
      where: { userId, currency, walletType },
      defaults: {
        availableBalance: 0,
        lockedBalance: 0,
        accountNumber,
      },
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
      transaction_group_id = null,
      walletId,
      userId,
      type,
      amount,
      currency,
      receiptId = null,
      meta = {},
      performedBy = null,
    },
    transaction,
  ) {
    const groupId = this._makeGroupId(transaction_group_id);
    return WalletTransaction.create(
      {
        transaction_group_id: groupId,
        walletId,
        userId,
        type,
        amount,
        currency,
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
  async listFxConvertWalletTransactions({
    userId,
    page = 1,
    limit = 20,
    grouped = false,
    transaction_group_id,
  } = {}) {
    const uid = Number(userId);
    if (Number.isNaN(uid) || uid <= 0) {
      throw new Error("userId is required");
    }

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(String(limit), 10) || 20),
    );
    const offset = (pageNum - 1) * limitNum;

    const where = {
      userId: uid,
      receiptId: null,
      type: "CONVERT",
    };

    if (transaction_group_id) {
      where.transaction_group_id = String(transaction_group_id).trim();
    }

    const { rows, count } = await WalletTransaction.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: limitNum,
      offset,
    });

    if (grouped) {
      const groups = new Map();
      for (const row of rows) {
        const gid = row.transaction_group_id || "ungrouped";
        if (!groups.has(gid)) groups.set(gid, []);
        groups.get(gid).push(row);
      }
      return {
        groups: Array.from(groups.entries()).map(([gid, items]) => ({
          transaction_group_id: gid,
          items,
        })),
        total: count,
        page: pageNum,
        limit: limitNum,
      };
    }

    return { data: rows, total: count, page: pageNum, limit: limitNum };
  }

  async deposit({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
    performedBy = null,
    transaction_group_id = null,
  }) {
    return sequelize.transaction(async (t) => {
      const depositAmount = Number(amount);
      if (!depositAmount || Number.isNaN(depositAmount) || depositAmount <= 0) {
        throw new Error("Invalid amount");
      }

      const groupId = this._makeGroupId(transaction_group_id);
      const wallet = await this.getOrCreateWallet(
        userId,
        currency,
        walletType,
        t,
      );

      const before = Number(wallet.availableBalance) || 0;
      const after = before + depositAmount;

      wallet.availableBalance = after;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: wallet.id,
          userId,
          type: "DEPOSIT",
          amount: depositAmount,
          currency,
          receiptId,
          meta: { ...meta, balanceBefore: before, balanceAfter: after },
          performedBy,
        },
        t,
      );

      return wallet;
    });
  }

  async withdraw({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId = null,
    meta = {},
    performedBy = null,
    transaction_group_id = null,
  }) {
    return sequelize.transaction(async (t) => {
      const wallet = await Wallet.findOne({
        where: { userId, currency, walletType },
        transaction: t,
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const before = Number(wallet.availableBalance) || 0;
      const withdrawAmount = Number(amount);

      if (
        !withdrawAmount ||
        Number.isNaN(withdrawAmount) ||
        withdrawAmount <= 0
      ) {
        throw new Error("Invalid amount");
      }

      if (before < withdrawAmount) {
        throw new Error("Insufficient available balance");
      }

      const after = before - withdrawAmount;

      wallet.availableBalance = after;
      await wallet.save({ transaction: t });

      const groupId = this._makeGroupId(transaction_group_id);
      const walletTransaction = await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: wallet.id,
          userId,
          type: "WITHDRAW",
          amount: -withdrawAmount,
          currency,
          receiptId,
          meta: { ...meta, balanceBefore: before, balanceAfter: after },
          performedBy,
        },
        t,
      );

      return { wallet, walletTransaction };
    });
  }

  /**
   * Receipt approval flow: always DEPOSIT, then optionally LOCK (same currency).
   * Returns the generated group ids for traceability.
   */
  async receiptApproveDepositAndMaybeLock({
    userId,
    currency,
    amount,
    walletType = "PERSONAL",
    receiptId,
    performedBy = null,
    isLock = false,
  }) {
    const depositAmount = Number(amount);
    const normalizedCurrency = String(currency || "")
      .trim()
      .toUpperCase();
    if (!depositAmount || Number.isNaN(depositAmount) || depositAmount <= 0) {
      throw new Error("Invalid amount");
    }
    if (!normalizedCurrency || normalizedCurrency.length !== 3) {
      throw new Error("Invalid currency");
    }

    const depositGroupId = this._makeGroupId(null);
    const lockGroupId = isLock ? this._makeGroupId(null) : null;

    return sequelize.transaction(async (t) => {
      const wallet = await this.getOrCreateWallet(
        userId,
        normalizedCurrency,
        walletType,
        t,
      );

      const availableBeforeDeposit = Number(wallet.availableBalance) || 0;
      const availableAfterDeposit = availableBeforeDeposit + depositAmount;
      wallet.availableBalance = availableAfterDeposit;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          transaction_group_id: depositGroupId,
          walletId: wallet.id,
          userId,
          type: "DEPOSIT",
          amount: depositAmount,
          currency: normalizedCurrency,
          receiptId: receiptId || null,
          meta: {
            source: "receipt_approve",
            balanceBefore: availableBeforeDeposit,
            balanceAfter: availableAfterDeposit,
          },
          performedBy,
        },
        t,
      );

      if (!isLock) {
        return { wallet, depositGroupId, lockGroupId };
      }

      const lockedBefore = Number(wallet.lockedBalance) || 0;
      const availableBeforeLock = Number(wallet.availableBalance) || 0;
      if (availableBeforeLock < depositAmount) {
        throw new Error("Insufficient available balance to lock after deposit");
      }

      const availableAfterLock = availableBeforeLock - depositAmount;
      const lockedAfter = lockedBefore + depositAmount;
      wallet.availableBalance = availableAfterLock;
      wallet.lockedBalance = lockedAfter;
      await wallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          transaction_group_id: lockGroupId,
          walletId: wallet.id,
          userId,
          type: "LOCK",
          amount: -depositAmount,
          currency: normalizedCurrency,
          receiptId: receiptId || null,
          meta: {
            source: "receipt_lock",
            lockedBy: performedBy,
            balanceBefore: availableBeforeLock,
            balanceAfter: availableAfterLock,
            lockedBefore,
            lockedAfter,
          },
          performedBy,
        },
        t,
      );

      return { wallet, depositGroupId, lockGroupId };
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
    transaction_group_id = null,
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
      if (!lockAmount || Number.isNaN(lockAmount) || lockAmount <= 0) {
        throw new Error("Invalid amount");
      }

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

      const groupId = this._makeGroupId(transaction_group_id);
      await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: wallet.id,
          userId,
          type: "LOCK",
          amount: -lockAmount,
          currency,
          receiptId,
          meta: {
            ...meta,
            balanceBefore: beforeAvailable,
            balanceAfter: afterAvailable,
            lockedBefore: beforeLocked,
            lockedAfter: afterLocked,
          },
          performedBy,
        },
        t,
      );

      return { wallet, transaction_group_id: groupId };
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
    transaction_group_id = null,
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

      const groupId = this._makeGroupId(transaction_group_id);
      await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: wallet.id,
          userId,
          type: "UNLOCK",
          amount: unlockAmount,
          currency,
          receiptId: null,
          meta: {
            ...meta,
            balanceBefore: beforeAvailable,
            balanceAfter: afterAvailable,
            lockedBefore: beforeLocked,
            lockedAfter: afterLocked,
          },
          performedBy,
        },
        t,
      );

      return { wallet, transaction_group_id: groupId };
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
    transaction_group_id = null,
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

      const groupId = this._makeGroupId(transaction_group_id);
      await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: wallet.id,
          userId,
          type: "LOCK",
          // This operation does not change availableBalance (locked balance only)
          amount: 0,
          currency,
          receiptId,
          meta: {
            ...meta,
            lockedBefore: beforeLocked,
            lockedAfter: afterLocked,
            lockedDelta: Number(amount),
          },
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
    transaction_group_id = null,
  }) {
    return sequelize.transaction(async (t) => {
      const groupId = this._makeGroupId(transaction_group_id);
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

      const lockedInReceiptCurrency =
        Number(receiptCurrencyWallet.lockedBalance) || 0;
      const amountToUnlockNum = Number(amountToUnlock);

      if (lockedInReceiptCurrency < amountToUnlockNum) {
        throw new Error("Insufficient locked balance");
      }

      const afterLocked = lockedInReceiptCurrency - amountToUnlockNum;
      receiptCurrencyWallet.lockedBalance = afterLocked;

      // 2. Add to availableBalance: same wallet if same currency, else target-currency wallet
      // Same currency: use amountToUnlock (no conversion). Different: use amount (converted).
      const amountToAddToAvailable =
        currency === receiptCurrency ? amountToUnlockNum : Number(amount);

      if (currency === receiptCurrency) {
        // Same currency: add to same wallet's availableBalance
        const beforeAvailable =
          Number(receiptCurrencyWallet.availableBalance) || 0;
        receiptCurrencyWallet.availableBalance =
          beforeAvailable + amountToAddToAvailable;
        await receiptCurrencyWallet.save({ transaction: t });

        await this.createWalletTransaction(
          {
            transaction_group_id: groupId,
            walletId: receiptCurrencyWallet.id,
            userId,
            type: "UNLOCK",
            amount: amountToAddToAvailable,
            currency: receiptCurrency,
            receiptId,
            meta: {
              ...meta,
              balanceBefore: beforeAvailable,
              balanceAfter: beforeAvailable + amountToAddToAvailable,
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
          transaction_group_id: groupId,
          walletId: targetWallet.id,
          userId,
          type: "UNLOCK",
          amount: amountToAddToAvailable,
          currency,
          receiptId,
          meta: {
            ...meta,
            balanceBefore: beforeAvailable,
            balanceAfter: afterAvailable,
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
    performedBy = null,
    transaction_group_id = null,
  }) {
    const uid = Number(userId);
    const fromCur = String(fromCurrency || "")
      .trim()
      .toUpperCase();
    const toCur = String(toCurrency || "")
      .trim()
      .toUpperCase();
    const amountFrom = Number(amountInSource);
    const r = Number(rate);

    if (!uid || Number.isNaN(uid)) throw new Error("Invalid userId");
    if (!fromCur || fromCur.length !== 3)
      throw new Error("Invalid fromCurrency");
    if (!toCur || toCur.length !== 3) throw new Error("Invalid toCurrency");
    if (fromCur === toCur)
      throw new Error("fromCurrency and toCurrency must differ");
    if (!amountFrom || Number.isNaN(amountFrom) || amountFrom <= 0) {
      throw new Error("Invalid amount");
    }
    if (!r || Number.isNaN(r) || r <= 0) {
      throw new Error("Invalid rate");
    }

    const amountTarget = amountFrom / r;
    const groupId = this._makeGroupId(transaction_group_id);

    return sequelize.transaction(async (t) => {
      const fromWallet = await this.getOrCreateWallet(
        uid,
        fromCur,
        walletType,
        t,
      );
      const toWallet = await this.getOrCreateWallet(uid, toCur, walletType, t);

      const fromBefore = Number(fromWallet.availableBalance) || 0;
      if (fromBefore < amountFrom) {
        throw new Error("Insufficient funds in source currency");
      }

      const fromAfter = fromBefore - amountFrom;
      fromWallet.availableBalance = fromAfter;
      await fromWallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: fromWallet.id,
          userId: uid,
          type: "CONVERT",
          amount: -amountFrom,
          currency: fromCur,
          receiptId: null,
          meta: {
            ...meta,
            direction: "out",
            toCurrency: toCur,
            amountInTarget: amountTarget,
            rate: r,
            balanceBefore: fromBefore,
            balanceAfter: fromAfter,
          },
          performedBy,
        },
        t,
      );

      const toBefore = Number(toWallet.availableBalance) || 0;
      const toAfter = toBefore + amountTarget;
      toWallet.availableBalance = toAfter;
      await toWallet.save({ transaction: t });

      await this.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: toWallet.id,
          userId: uid,
          type: "CONVERT",
          amount: amountTarget,
          currency: toCur,
          receiptId: null,
          meta: {
            ...meta,
            direction: "in",
            fromCurrency: fromCur,
            amountInSource: amountFrom,
            rate: r,
            balanceBefore: toBefore,
            balanceAfter: toAfter,
          },
          performedBy,
        },
        t,
      );

      return {
        transaction_group_id: groupId,
        fromWallet,
        toWallet,
        amountInSource: amountFrom,
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
    return this.fxConvert({
      userId,
      fromCurrency: "USD",
      toCurrency: "CNY",
      amountInSource: usdAmount,
      rate,
      walletType: "PERSONAL",
      meta: { source: "convert_usd_to_cny" },
      performedBy: userId,
    });
  }

  async listWalletTransactions({
    page = 1,
    limit = 10,
    type,
    currency,
    userId,
    receiptId,
    startDate,
    endDate,
    transaction_group_id,
  } = {}) {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(String(limit), 10) || 10),
    );
    const offset = (pageNum - 1) * limitNum;

    const where = {};

    if (type) where.type = String(type).toUpperCase();
    if (currency) where.currency = String(currency).toUpperCase();
    if (userId) {
      const uid = Number(userId);
      if (!Number.isNaN(uid) && uid > 0) where.userId = uid;
    }
    if (receiptId != null && receiptId !== "") {
      where.receiptId = receiptId;
    }
    if (transaction_group_id) {
      where.transaction_group_id = String(transaction_group_id).trim();
    }

    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)],
      };
    }

    const { rows: transactions, count: totalRows } =
      await WalletTransaction.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "email"],
          },
          {
            model: User,
            as: "performer",
            attributes: ["id", "username", "email"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: limitNum,
        offset,
      });

    const grouped = {};

    for (const tx of transactions) {
      const groupId = tx.transaction_group_id || "ungrouped";

      if (!grouped[groupId]) {
        grouped[groupId] = {
          transaction_group_id: groupId,
          transactions: [],
          summary: {
            total_credit: 0,
            total_debit: 0,
          },
          meta: null,
        };
      }

      grouped[groupId].transactions.push(tx);

      const amount = Number(tx.amount);
      if (amount > 0) grouped[groupId].summary.total_credit += amount;
      else grouped[groupId].summary.total_debit += amount;

      if (tx.meta?.lock_reference_group_id) {
        grouped[groupId].meta = {
          lock_reference_group_id: tx.meta.lock_reference_group_id,
        };
      }
    }

    const groupedArray = Object.values(grouped);

    let income_expense_by_currency = null;
    let transfer_totals = null;

    if (where.userId != null) {
      const transferWhere = {
        userId: where.userId,
        type: "TRANSFER",
      };
      if (currency) transferWhere.currency = String(currency).toUpperCase();
      if (receiptId != null && receiptId !== "") {
        transferWhere.receiptId = receiptId;
      }
      if (transaction_group_id) {
        transferWhere.transaction_group_id =
          String(transaction_group_id).trim();
      }
      if (startDate && endDate) {
        transferWhere.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        };
      }

      const transferRows = await WalletTransaction.findAll({
        where: transferWhere,
        attributes: ["amount", "currency", "type"],
      });

      const summary = this._buildTransferIncomeExpenseSummary(transferRows);
      income_expense_by_currency = summary.income_expense_by_currency;
      transfer_totals = summary.transfer_totals;
    }

    return {
      data: groupedArray,
      page: pageNum,
      limit: limitNum,
      count: groupedArray.length,
      total: totalRows,
      income_expense_by_currency,
      transfer_totals,
    };
  }

  async listMyWalletTransactions({
    userId,
    page = 1,
    limit = 20,
    type,
    grouped = false,
    transaction_group_id,
  } = {}) {
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(String(limit), 10) || 20),
    );
    const offset = (pageNum - 1) * limitNum;
    const where = { userId };
    if (transaction_group_id) {
      where.transaction_group_id = String(transaction_group_id).trim();
    }

    if (type) {
      const normalizedType = String(type).toUpperCase();
      const allowed = [
        "DEPOSIT",
        "WITHDRAW",
        "LOCK",
        "UNLOCK",
        "TRANSFER",
        "CONVERT",
      ];
      if (!allowed.includes(normalizedType)) {
        throw new Error("Invalid type filter");
      }
      where.type = normalizedType;
    }

    const transactions = await WalletTransaction.findAndCountAll({
      limit: limitNum,
      offset,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "username", "email"],
        },
        {
          model: User,
          as: "performer",
          attributes: ["id", "username", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      where,
    });

    const transferSummaryWhere = { userId, type: "TRANSFER" };
    if (transaction_group_id) {
      transferSummaryWhere.transaction_group_id =
        String(transaction_group_id).trim();
    }

    const transferRowsForSummary = await WalletTransaction.findAll({
      where: transferSummaryWhere,
      attributes: ["amount", "currency", "type"],
    });

    const { income_expense_by_currency, transfer_totals } =
      this._buildTransferIncomeExpenseSummary(transferRowsForSummary);

    if (grouped) {
      const groupedMap = {};

      for (const tx of transactions.rows) {
        const groupId = tx.transaction_group_id || "ungrouped";

        if (!groupedMap[groupId]) {
          groupedMap[groupId] = {
            transaction_group_id: groupId,
            transactions: [],
            summary: {
              total_credit: 0,
              total_debit: 0,
            },
            meta: null,
          };
        }

        groupedMap[groupId].transactions.push(tx);

        const amount = Number(tx.amount) || 0;
        if (amount > 0) {
          groupedMap[groupId].summary.total_credit += amount;
        } else if (amount < 0) {
          groupedMap[groupId].summary.total_debit += Math.abs(amount);
        }

        if (tx.meta?.lock_reference_group_id) {
          groupedMap[groupId].meta = {
            lock_reference_group_id: tx.meta.lock_reference_group_id,
          };
        }
      }

      return {
        data: Object.values(groupedMap),
        total: transactions.count,
        page: pageNum,
        limit: limitNum,
        income_expense_by_currency,
        transfer_totals,
      };
    }

    return {
      data: transactions.rows,
      total: transactions.count,
      page: pageNum,
      limit: limitNum,
      income_expense_by_currency,
      transfer_totals,
    };
  }
}

module.exports = WalletService;
