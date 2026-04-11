const ReceiptRepository = require("../repositories/ReceiptRepository");
const BankAccount = require("../models/bankAccount");
const UserService = require("./UserService");
const userService = new UserService();
const WalletService = require("./WalletService");
const CurrencyService = require("./CurrencyService");
const Wallet = require("../models/wallet");
const WalletTransaction = require("../models/walletTransaction");
const crypto = require("crypto");
const walletService = new WalletService();
const currencyService = new CurrencyService();

class ReceiptService {
  constructor() {
    this.receiptRepository = new ReceiptRepository();
  }

  async getReceiptsByUserId(userId) {
    return this.receiptRepository.getReceiptsByUserId(userId);
  }

  async getAdminReceipts() {
    return this.receiptRepository.getAdminReceipts();
  }

  async getReceiptById(userId, receiptId) {
    return this.receiptRepository.getReceiptById(userId, receiptId);
  }

  async createReceipt(userId, data) {
    // Validate sender and receiver exist
    const { senderId, receiverId } = data;
    const sender = await BankAccount.findByPk(senderId);
    if (!sender) {
      const err = new Error("Sender bank account not found");
      err.name = "InvalidBankAccountError";
      throw err;
    }
    const receiver = await BankAccount.findByPk(receiverId);
    if (!receiver) {
      const err = new Error("Receiver bank account not found");
      err.name = "InvalidBankAccountError";
      throw err;
    }

    return this.receiptRepository.createReceipt(userId, data);
  }

  async updateReceipt(userId, receiptId, updateData, approverUser = null) {
    // If sender/receiver are being changed, validate them
    if (updateData.senderId) {
      const sender = await BankAccount.findByPk(updateData.senderId);
      if (!sender) {
        const err = new Error("Sender bank account not found");
        err.name = "InvalidBankAccountError";
        throw err;
      }
    }
    if (updateData.receiverId) {
      const receiver = await BankAccount.findByPk(updateData.receiverId);
      if (!receiver) {
        const err = new Error("Receiver bank account not found");
        err.name = "InvalidBankAccountError";
        throw err;
      }
    }

    // Fetch current receipt to detect transitions
    const current = await this.receiptRepository.getReceiptById(
      userId,
      receiptId,
    );
    if (!current) return null;

    const wasApproved =
      current.type === "approved" || current.status === "approved";
    const willBeApproved =
      (updateData.type && updateData.type === "approved") ||
      (updateData.status && updateData.status === "approved");

    // If approving now (and wasn't approved before), record approver if provided.
    // Authorization is enforced by the `authorize` middleware on the route.
    if (willBeApproved && !wasApproved) {
      if (approverUser && approverUser.id) {
        updateData.approvedBy = approverUser.id;
      }
    }

    const updated = await this.receiptRepository.updateReceipt(
      userId,
      receiptId,
      updateData,
    );

    // After updating, if we've just approved, credit the user's usdWalletBalance
    if (willBeApproved && !wasApproved && updated) {
      // compute amount to credit: prefer newAmount when present
      const amountToCredit =
        updated.newAmount && Number(updated.newAmount) > 0
          ? Number(updated.newAmount)
          : Number(updated.amount);
      if (amountToCredit && amountToCredit > 0) {
        // load the user and increment usdWalletBalance
        const User = require("../models/user");
        const targetUser = await User.findByPk(updated.userId);
        if (targetUser) {
          const currentBalance = Number(targetUser.usdWalletBalance) || 0;
          targetUser.usdWalletBalance = currentBalance + amountToCredit;
          await targetUser.save();
        }
      }
    }

    return updated;
  }

  async deleteReceipt(userId, receiptId) {
    return this.receiptRepository.deleteReceipt(userId, receiptId);
  }

  async adminDeleteReceipt(receiptId) {
    const receipt = await this.receiptRepository.getReceiptByPk(receiptId);
    if (!receipt) {
      return null;
    }

    // if (receipt.status === "approved") {
    //   const err = new Error(
    //     "Approved receipts cannot be deleted because they already affect wallet balances.",
    //   );
    //   err.name = "InvalidReceiptStateError";
    //   throw err;
    // }

    return this.receiptRepository.adminDeleteReceipt(receiptId);
  }

  // Admin-specific update: allows admins to edit a receipt and adjusts credited USD accordingly
  async adminUpdateReceipt(receiptId, updateData, adminUser = null) {
    // sanitize and validate incoming fields
    const sanitized = {};
    if (!updateData || typeof updateData !== "object") {
      throw new Error("Invalid update payload");
    }
    // handle numeric fields
    if (Object.prototype.hasOwnProperty.call(updateData, "newAmount")) {
      const na = Number(updateData.newAmount);
      if (Number.isNaN(na) || na < 0) throw new Error("Invalid newAmount");
      sanitized.newAmount = na;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
      const s = String(updateData.status).toLowerCase();
      const allowedStatuses = ["pending", "approved", "rejected", "hold"];
      if (!allowedStatuses.includes(s)) throw new Error("Invalid status");
      sanitized.status = s;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "senderId")) {
      const sid = Number(updateData.senderId);
      if (Number.isNaN(sid)) throw new Error("Invalid senderId");
      sanitized.senderId = sid;
    }
    if (Object.prototype.hasOwnProperty.call(updateData, "receiverId")) {
      const rid = Number(updateData.receiverId);
      if (Number.isNaN(rid)) throw new Error("Invalid receiverId");
      sanitized.receiverId = rid;
    }

    // validate bank accounts if provided
    if (sanitized.senderId) {
      const sender = await BankAccount.findByPk(sanitized.senderId);
      if (!sender) {
        const err = new Error("Sender bank account not found");
        err.name = "InvalidBankAccountError";
        throw err;
      }
    }
    if (sanitized.receiverId) {
      const receiver = await BankAccount.findByPk(sanitized.receiverId);
      if (!receiver) {
        const err = new Error("Receiver bank account not found");
        err.name = "InvalidBankAccountError";
        throw err;
      }
    }

    // perform update inside a transaction to keep balances consistent
    // const transaction = await sequelize.transaction();
    try {
      // fetch existing receipt (admin access) with transaction
      const current = await this.receiptRepository.getReceiptByPk(receiptId);
      if (!current) {
        // await transaction.rollback();
        return null;
      }

      const previouslyApproved = current.status === "approved";
      const previouslyCreditedAmount = previouslyApproved
        ? current.newAmount && Number(current.newAmount) > 0
          ? Number(current.newAmount)
          : Number(current.amount)
        : 0;

      // Only set approvedBy when admin is approving the receipt (status === 'approved')
      if (adminUser && adminUser.id && sanitized.status === "approved") {
        sanitized.approvedBy = adminUser.id;
      }

      console.log("Admin updating receipt with data:", sanitized);
      // update receipt within transaction using sanitized data
      const updatec = await this.receiptRepository.update(receiptId, sanitized);
      console.log("Admin updatec", updatec);
      // reload to get latest values (within transaction)
      const updated = await require("../models/receipt").findByPk(receiptId);
      console.log("Updated receipt:", updated);
      // determine post-update approved state and amount
      const nowApproved = updated.status === "approved";
      const nowCreditedAmount = nowApproved
        ? updated.newAmount && Number(updated.newAmount) > 0
          ? Number(updated.newAmount)
          : Number(updated.amount)
        : 0;

      // reconcile user usdWalletBalance
      const User = require("../models/user");
      const targetUser = await User.findByPk(updated.userId);
      if (targetUser) {
        if (previouslyApproved && !nowApproved) {
          // subtract previously credited amount
          const currentBalance = Number(targetUser.usdWalletBalance) || 0;
          targetUser.usdWalletBalance =
            currentBalance - previouslyCreditedAmount;
          await targetUser.save();
        } else if (!previouslyApproved && nowApproved) {
          // newly approved -> credit nowCreditedAmount
          const currentBalance = Number(targetUser.usdWalletBalance) || 0;
          targetUser.usdWalletBalance = currentBalance + nowCreditedAmount;
          await targetUser.save();
        } else if (previouslyApproved && nowApproved) {
          // both approved -> adjust by delta (if amount changed)
          const delta = nowCreditedAmount - previouslyCreditedAmount;
          if (delta !== 0) {
            const currentBalance = Number(targetUser.usdWalletBalance) || 0;
            targetUser.usdWalletBalance = currentBalance + delta;
            await targetUser.save();
          }
        }
      }

      // await transaction.commit();
      // reload updated outside tx (with includes)
      return await this.receiptRepository.getReceiptByPk(receiptId);
    } catch (err) {
      // await transaction.rollback();
      throw err;
    }
  }

  async approveReceipt(
    receiptId,
    approverUser = null,
    newAmount = null,
    isLockOverride = null,
  ) {
    // fetch receipt
    const receipt = await this.receiptRepository.findReceiptById(receiptId);
    if (receipt.status === "approved") {
      return { message: "Receipt already approved", receipt };
    }
    const updated = await this.receiptRepository.updateReceiptStatus(
      receiptId,
      "approved",
    );
    if (!receipt) return null;

    // record approver identity (authorization handled by route middleware)
    if (approverUser && approverUser.id) {
      await receipt.update({ approvedBy: approverUser.id });
    }

    // If caller provided a newAmount in the API call, persist it and prefer it when crediting
    if (newAmount !== null && newAmount !== undefined) {
      // try to parse numeric
      const parsed = Number(newAmount);
      if (!Number.isNaN(parsed)) {
        await receipt.update({ newAmount: parsed });
        receipt.newAmount = parsed;
      }
    }
    // If caller provided isLock explicitly, override the flag before crediting
    if (typeof isLockOverride === "boolean") {
      console.log(
        `Overriding receipt ${receipt.id} isLock to ${isLockOverride} for approval processing`,
      );
      await receipt.update({ isLock: isLockOverride , status: "approved"});
      receipt.isLock = isLockOverride;
    }
    // compute amount to credit (prefer receipt.newAmount when present)
    const amountToCredit =
      receipt.newAmount && Number(receipt.newAmount) > 0
        ? Number(receipt.newAmount)
        : Number(receipt.amount);

    if (amountToCredit && amountToCredit > 0) {
      const currency = receipt.currency || "USD";
      const userId = receipt.userId;

      console.log(
        `Applying receipt ${receipt.id} to wallet for user ${userId}, amount ${amountToCredit}, currency ${currency}, isLock=${receipt.isLock}`,
      );

      const performedBy = approverUser && approverUser.id ? approverUser.id : null;
      const result = await walletService.receiptApproveDepositAndMaybeLock({
        userId,
        currency,
        amount: amountToCredit,
        walletType: "PERSONAL",
        receiptId: receipt.id,
        performedBy,
        isLock: Boolean(receipt.isLock),
      });

      return {
        message: "Receipt approved",
        receipt,
        transaction_group_ids: {
          deposit: result.depositGroupId,
          lock: result.lockGroupId,
        },
      };
    }

    return { message: "Receipt approved", receipt };
  }

  async rejectReceipt(receiptId, approverUser = null) {
    const receipt = await this.receiptRepository.updateReceiptStatus(
      receiptId,
      "rejected",
    );
    if (!receipt) return null;
    // If approver provided, set approvedBy
    if (approverUser && approverUser.id) {
      await receipt.update({ approvedBy: approverUser.id });
    }
    return receipt;
  }

  async unlockLockedReceiptFunds(receiptId, adminUser = null, currency) {
    // Load receipt with user & bank accounts (admin-level access)
    const receipt = await this.receiptRepository.getReceiptByPk(receiptId);
    if (!receipt) {
      return null;
    }

    // Default to receipt currency when not provided (same-currency unlock)
    const targetCurrency = currency && String(currency).trim() ? currency : receipt.currency;

    // Rate from receipt currency → target (e.g. EUR per 1 CNY). getAdjustedRate(target, base) returns "target per base".
    const currentRate =
      targetCurrency === receipt.currency
        ? { finalRate: 1 }
        : await currencyService.getAdjustedRate(targetCurrency, receipt.currency);

    // Only allow unlocking if:
    // - receipt is approved (already credited into lockedBalance)
    // - and currently locked
    if (receipt.status !== "approved") {
      const err = new Error("Only approved receipts can be unlocked");
      err.name = "InvalidReceiptStateError";
      throw err;
    }
    if (!receipt.isLock) {
      const err = new Error("Receipt funds are not locked or already unlocked");
      err.name = "InvalidReceiptStateError";
      throw err;
    }

    // Determine how much was locked for this receipt
    const amountToUnlock =
      receipt.newAmount && Number(receipt.newAmount) > 0
        ? Number(receipt.newAmount)
        : Number(receipt.amount);
    const rate =
      currentRate && typeof currentRate.finalRate === "number"
        ? currentRate.finalRate
        : targetCurrency === receipt.currency
          ? 1
          : 0;
    // convertedAmount in target currency = amount in receipt currency × (target per receipt)
    const convertedAmount = amountToUnlock * rate;

    if (
      !amountToUnlock ||
      Number.isNaN(amountToUnlock) ||
      amountToUnlock <= 0
    ) {
      const err = new Error("Invalid receipt amount to unlock");
      err.name = "InvalidAmountError";
      throw err;
    }

    if (Number.isNaN(convertedAmount) || convertedAmount <= 0) {
      const err = new Error("Invalid converted amount for unlock (check currency/rate)");
      err.name = "InvalidAmountError";
      throw err;
    }

    const userId = receipt.userId;

    // Find the most recent LOCK group for this receipt (required for linkage)
    const lastLockTx = await WalletTransaction.findOne({
      where: { receiptId: receipt.id, type: "LOCK" },
      order: [["createdAt", "DESC"]],
    });
    const previousLockGroupId = lastLockTx?.transaction_group_id;
    if (!previousLockGroupId) {
      const err = new Error(
        "Missing lock reference: no LOCK transaction_group_id found for this receipt.",
      );
      err.name = "InvalidReceiptStateError";
      throw err;
    }

    // Move funds: lockedBalance -> availableBalance using WalletService
    const performedBy = adminUser && adminUser.id ? adminUser.id : null;
    const groupId = crypto.randomUUID();
    await walletService.unlockFunds({
      userId,
      currency: targetCurrency,
      amountToUnlock,
      receiptCurrency: receipt.currency,
      amount: convertedAmount,
      walletType: "PERSONAL",
      receiptId: receipt.id,
      performedBy,
      transaction_group_id: groupId,
      meta: {
        source: "receipt_unlock",
        unlockedBy: performedBy,
        lock_reference_group_id: previousLockGroupId,
      },
    });

    const sameCurrency =
      String(targetCurrency).toUpperCase() === String(receipt.currency).toUpperCase();

    // Mark receipt as no longer locked; block future re-lock if unlocked to another currency
    await receipt.update({
      isLock: false,
      relockDisabled: !sameCurrency,
    });

    // Return fresh copy with includes + linkage info
    const refreshed = await this.receiptRepository.getReceiptByPk(receiptId);
    return {
      receipt: refreshed,
      transaction_group_id: groupId,
      meta: { lock_reference_group_id: previousLockGroupId },
    };
  }

  /**
   * Re-lock an unlocked receipt: move amount from availableBalance to lockedBalance
   * (same currency). Only if receipt is approved, currently unlocked, and user has
   * sufficient available balance in receipt currency.
   */
  async lockReceiptFunds(receiptId, adminUser = null) {
    const receipt = await this.receiptRepository.getReceiptByPk(receiptId);
    if (!receipt) {
      return null;
    }

    if (receipt.status !== "approved") {
      const err = new Error("Only approved receipts can be re-locked");
      err.name = "InvalidReceiptStateError";
      throw err;
    }
    if (receipt.isLock) {
      const err = new Error("Receipt is already locked");
      err.name = "InvalidReceiptStateError";
      throw err;
    }
    if (receipt.relockDisabled) {
      const err = new Error(
        "This receipt cannot be re-locked after it was unlocked to a different currency.",
      );
      err.name = "InvalidReceiptStateError";
      throw err;
    }

    const amountToLock =
      receipt.newAmount && Number(receipt.newAmount) > 0
        ? Number(receipt.newAmount)
        : Number(receipt.amount);

    if (!amountToLock || amountToLock <= 0) {
      const err = new Error("Invalid receipt amount to lock");
      err.name = "InvalidAmountError";
      throw err;
    }
    const performedBy = adminUser && adminUser.id ? adminUser.id : null;
    const groupId = crypto.randomUUID();
    await walletService.lockFunds({
      userId: receipt.userId,
      currency: receipt.currency,
      amount: amountToLock,
      walletType: "PERSONAL",
      receiptId: receipt.id,
      meta: {
        source: "receipt_lock",
        lockedBy: performedBy,
      },
      performedBy,
      transaction_group_id: groupId,
    });

    await receipt.update({ isLock: true });

    const refreshed = await this.receiptRepository.getReceiptByPk(receiptId);
    return { receipt: refreshed, transaction_group_id: groupId };
  }
}

module.exports = ReceiptService;
