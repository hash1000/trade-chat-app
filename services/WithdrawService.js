const WithdrawRepository = require("../repositories/WithdrawRepository");
const BankAccount = require("../models/bankAccount");
const sequelize = require("../config/database");
const WalletService = require("./WalletService");
const NotificationService = require("./NotificationService");
const walletService = new WalletService();
const notificationService = new NotificationService();

const fmtAmount = (v) => Number(v).toString();

const ALLOWED_WALLET_TYPES = ["PERSONAL", "COMPANY"];

class WithdrawService {
  constructor() {
    this.withdrawRepository = new WithdrawRepository();
  }

  async getWithdrawsByUserId(userId, options) {
    return this.withdrawRepository.getWithdrawsByUserId(userId, options);
  }

  async getAdminWithdraws(options) {
    return this.withdrawRepository.getAdminWithdraws(options);
  }

  async getWithdrawById(userId, withdrawId) {
    return this.withdrawRepository.getWithdrawById(userId, withdrawId);
  }

  /**
   * Create a withdraw request. The amount is deducted from the user's wallet
   * immediately (userStatus: success), while the admin side stays pending.
   * Withdraw row + wallet deduction + wallet transaction happen atomically.
   */
  async createWithdraw(userId, data) {
    const { bankCardId, walletType, currency, amount, note } = data;

    const bankCard = await BankAccount.findByPk(bankCardId);
    if (!bankCard) {
      const err = new Error("Bank card not found");
      err.name = "InvalidBankAccountError";
      throw err;
    }

    const resolvedWalletType = walletType || "PERSONAL";
    if (!ALLOWED_WALLET_TYPES.includes(resolvedWalletType)) {
      const err = new Error("walletType must be PERSONAL or COMPANY");
      err.name = "SequelizeValidationError";
      throw err;
    }

    const withdrawAmount = Number(amount);
    if (!withdrawAmount || Number.isNaN(withdrawAmount) || withdrawAmount <= 0) {
      const err = new Error("Invalid amount");
      err.name = "InvalidAmountError";
      throw err;
    }

    const normalizedCurrency = String(currency || "USD").trim().toUpperCase();

    const created = await sequelize.transaction(async (t) => {
      const wallet = await walletService.getOrCreateWallet(
        userId,
        normalizedCurrency,
        resolvedWalletType,
        t,
      );

      const before = Number(wallet.availableBalance) || 0;
      if (before < withdrawAmount) {
        const err = new Error("Insufficient available balance");
        err.name = "InsufficientBalanceError";
        throw err;
      }

      const withdraw = await this.withdrawRepository.createWithdraw(
        userId,
        {
          bankCardId,
          walletType: resolvedWalletType,
          currency: normalizedCurrency,
          amount: withdrawAmount,
          note: note || null,
          userStatus: "success",
          adminStatus: "pending",
        },
        t,
      );

      const after = before - withdrawAmount;
      wallet.availableBalance = after;
      await wallet.save({ transaction: t });

      await walletService.createWalletTransaction(
        {
          walletId: wallet.id,
          userId,
          type: "WITHDRAW",
          amount: -withdrawAmount,
          currency: normalizedCurrency,
          description: note || "Withdraw request",
          withdrawId: withdraw.id,
          meta: {
            source: "withdraw_request",
            balanceBefore: before,
            balanceAfter: after,
          },
          performedBy: userId,
        },
        t,
      );

      return withdraw;
    });

    const full = await this.withdrawRepository.getWithdrawByPk(created.id);

    // notify all staff about the new withdraw request (after commit)
    const requesterName =
      (full.user && (full.user.username || full.user.email)) || `User #${userId}`;
    await notificationService.notifyStaff({
      actorId: userId,
      type: "WITHDRAW_CREATED",
      title: "New Withdraw Request",
      message: `${requesterName} requested a withdraw of ${fmtAmount(full.amount)} ${full.currency} from their ${full.walletType} wallet (Withdraw #${full.id}).`,
      entityType: "WITHDRAW",
      entityId: full.id,
      data: {
        amount: fmtAmount(full.amount),
        currency: full.currency,
        walletType: full.walletType,
        requesterName,
        note: full.note || null,
        adminStatus: full.adminStatus,
      },
    });

    return full;
  }

  /**
   * Admin marks the withdraw as paid. Optional newAmount records the amount
   * actually paid out — for records only, the wallet is not touched again.
   */
  async payWithdraw(withdrawId, adminUser = null, newAmount = null, description = null) {
    const withdraw = await this.withdrawRepository.findWithdrawById(withdrawId);
    if (!withdraw) return null;

    if (withdraw.adminStatus !== "pending") {
      const err = new Error(`Withdraw is already ${withdraw.adminStatus}. Only pending withdraws can be paid.`);
      err.name = "InvalidWithdrawStateError";
      throw err;
    }

    const updateData = {
      adminStatus: "paid",
      userStatus: "paid",
      processedBy: adminUser && adminUser.id ? adminUser.id : null,
    };

    if (newAmount !== null && newAmount !== undefined) {
      const parsed = Number(newAmount);
      if (!Number.isNaN(parsed) && parsed > 0) {
        updateData.newAmount = parsed;
      }
    }
    if (description) {
      updateData.adminNote = description;
    }

    await withdraw.update(updateData);

    const paidAmount = updateData.newAmount || withdraw.amount;
    await notificationService.notifyUser({
      userId: withdraw.userId,
      actorId: updateData.processedBy,
      type: "WITHDRAW_PAID",
      title: "Withdraw Paid",
      message: `Your withdraw request #${withdraw.id} of ${fmtAmount(withdraw.amount)} ${withdraw.currency} has been paid${updateData.newAmount ? ` (paid amount: ${fmtAmount(updateData.newAmount)} ${withdraw.currency})` : ""}.${description ? ` Note: ${description}` : ""}`,
      entityType: "WITHDRAW",
      entityId: withdraw.id,
      data: {
        amount: fmtAmount(withdraw.amount),
        paidAmount: fmtAmount(paidAmount),
        currency: withdraw.currency,
        walletType: withdraw.walletType,
        adminStatus: "paid",
        adminNote: description || null,
      },
    });

    return this.withdrawRepository.getWithdrawByPk(withdrawId);
  }

  /**
   * Admin refunds the withdraw: the deducted amount goes back to the same
   * wallet (same currency and walletType). Note is optional.
   */
  async refundWithdraw(withdrawId, adminUser = null, description = null) {
    const withdraw = await this.withdrawRepository.findWithdrawById(withdrawId);
    if (!withdraw) return null;

    if (withdraw.adminStatus !== "pending") {
      const err = new Error(`Withdraw is already ${withdraw.adminStatus}. Only pending withdraws can be refunded.`);
      err.name = "InvalidWithdrawStateError";
      throw err;
    }

    const performedBy = adminUser && adminUser.id ? adminUser.id : null;

    await sequelize.transaction(async (t) => {
      await this._refundToWallet(withdraw, {
        description: description || "Withdraw refunded",
        performedBy,
        metaSource: "withdraw_refund",
        transaction: t,
      });

      await withdraw.update(
        {
          adminStatus: "refunded",
          userStatus: "refunded",
          processedBy: performedBy,
          adminNote: description || withdraw.adminNote,
        },
        { transaction: t },
      );
    });

    await notificationService.notifyUser({
      userId: withdraw.userId,
      actorId: performedBy,
      type: "WITHDRAW_REFUNDED",
      title: "Withdraw Refunded",
      message: `Your withdraw request #${withdraw.id} has been refunded — ${fmtAmount(withdraw.amount)} ${withdraw.currency} was returned to your ${withdraw.walletType} wallet.${description ? ` Note: ${description}` : ""}`,
      entityType: "WITHDRAW",
      entityId: withdraw.id,
      data: {
        amount: fmtAmount(withdraw.amount),
        currency: withdraw.currency,
        walletType: withdraw.walletType,
        adminStatus: "refunded",
        adminNote: description || null,
      },
    });

    return this.withdrawRepository.getWithdrawByPk(withdrawId);
  }

  /**
   * Soft delete. Pending withdraws are refunded back to the wallet first;
   * paid/refunded ones are just soft deleted.
   */
  async adminDeleteWithdraw(withdrawId, adminUser = null) {
    const withdraw = await this.withdrawRepository.findWithdrawById(withdrawId);
    if (!withdraw) return null;

    const performedBy = adminUser && adminUser.id ? adminUser.id : null;
    const wasPending = withdraw.adminStatus === "pending";

    await sequelize.transaction(async (t) => {
      if (withdraw.adminStatus === "pending") {
        await this._refundToWallet(withdraw, {
          description: "Withdraw deleted by admin — amount refunded",
          performedBy,
          metaSource: "withdraw_delete_refund",
          transaction: t,
        });

        await withdraw.update(
          {
            adminStatus: "refunded",
            userStatus: "refunded",
            processedBy: performedBy,
          },
          { transaction: t },
        );
      }

      await this.withdrawRepository.adminDeleteWithdraw(withdrawId, t);
    });

    await notificationService.notifyUser({
      userId: withdraw.userId,
      actorId: performedBy,
      type: "WITHDRAW_DELETED",
      title: "Withdraw Deleted",
      message: `Your withdraw request #${withdraw.id} of ${fmtAmount(withdraw.amount)} ${withdraw.currency} was deleted by admin${wasPending ? ` — the amount was refunded to your ${withdraw.walletType} wallet` : ""}.`,
      entityType: "WITHDRAW",
      entityId: withdraw.id,
      data: {
        amount: fmtAmount(withdraw.amount),
        currency: withdraw.currency,
        walletType: withdraw.walletType,
        refunded: wasPending,
      },
    });

    return true;
  }

  async adminBulkDeleteWithdraws(withdrawIds, adminUser = null) {
    const uniqueIds = [...new Set(withdrawIds.map((id) => Number(id)))];

    let deletedCount = 0;
    let refundedCount = 0;

    for (const id of uniqueIds) {
      const withdraw = await this.withdrawRepository.findWithdrawById(id);
      if (!withdraw) continue;

      const wasPending = withdraw.adminStatus === "pending";
      const deleted = await this.adminDeleteWithdraw(id, adminUser);
      if (deleted) {
        deletedCount += 1;
        if (wasPending) refundedCount += 1;
      }
    }

    return { requestedCount: uniqueIds.length, deletedCount, refundedCount };
  }

  // Credit the withdrawn amount back to the same wallet inside an existing transaction
  async _refundToWallet(withdraw, { description, performedBy, metaSource, transaction }) {
    const refundAmount = Number(withdraw.amount);
    if (!refundAmount || Number.isNaN(refundAmount) || refundAmount <= 0) {
      const err = new Error("Invalid withdraw amount to refund");
      err.name = "InvalidAmountError";
      throw err;
    }

    const wallet = await walletService.getOrCreateWallet(
      withdraw.userId,
      withdraw.currency,
      withdraw.walletType || "PERSONAL",
      transaction,
    );

    const before = Number(wallet.availableBalance) || 0;
    const after = before + refundAmount;
    wallet.availableBalance = after;
    await wallet.save({ transaction });

    await walletService.createWalletTransaction(
      {
        walletId: wallet.id,
        userId: withdraw.userId,
        type: "DEPOSIT",
        amount: refundAmount,
        currency: withdraw.currency,
        description,
        withdrawId: withdraw.id,
        meta: {
          source: metaSource,
          balanceBefore: before,
          balanceAfter: after,
        },
        performedBy,
      },
      transaction,
    );

    return wallet;
  }
}

module.exports = WithdrawService;
