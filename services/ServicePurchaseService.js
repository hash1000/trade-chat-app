// services/ServicePurchaseService.js
const { v4: uuidv4 } = require("uuid");
const sequelize = require("../config/database");
const { Wallet, WalletTransaction, Service } = require("../models");
const ServiceRepository = require("../repositories/ServiceRepository");
const ServicePurchaseRepository = require("../repositories/ServicePurchaseRepository");

class ServicePurchaseService {
  constructor() {
    this.serviceRepo = new ServiceRepository();
    this.purchaseRepo = new ServicePurchaseRepository();
  }

  async purchaseService(buyerUserId, serviceId, buyerWalletId) {
    // ─────────────────────────────────────────
    // 1. LOAD SERVICE
    // ─────────────────────────────────────────

    const service = await this.serviceRepo.findByPk(serviceId);

    if (!service) {
      throw Object.assign(new Error("Service not found."), {
        name: "NotFoundError",
      });
    }

    // Prevent self purchase
    if (service.userId === buyerUserId) {
      throw Object.assign(new Error("You cannot purchase your own service."), {
        name: "SelfPurchaseError",
      });
    }

    // ─────────────────────────────────────────
    // 2. LOAD BUYER WALLET
    // IMPORTANT: validate ownership
    // ─────────────────────────────────────────

    const buyerWallet = await Wallet.findOne({
      where: {
        id: buyerWalletId,
        userId: buyerUserId,
      },
    });

    if (!buyerWallet) {
      throw Object.assign(new Error("Buyer wallet not found."), {
        name: "WalletNotFoundError",
      });
    }

    // ─────────────────────────────────────────
    // 3. LOAD SELLER PAYOUT WALLET
    // ─────────────────────────────────────────

    const sellerWallet = await Wallet.findOne({
      where: {
        id: service.payoutWalletId,
        userId: service.userId,
      },
    });

    if (!sellerWallet) {
      throw Object.assign(new Error("Seller payout wallet not found."), {
        name: "OwnerWalletNotFoundError",
      });
    }

    // ─────────────────────────────────────────
    // 4. VALIDATE CURRENCY MATCH
    // ─────────────────────────────────────────

    if (buyerWallet.currency !== sellerWallet.currency) {
      throw Object.assign(
        new Error(
          `Currency mismatch. Buyer wallet uses ${buyerWallet.currency} while service accepts ${sellerWallet.currency}.`,
        ),
        { name: "UnsupportedCurrencyError" },
      );
    }

    const amount = parseFloat(service.price);

    // ─────────────────────────────────────────
    // 5. TRANSACTION
    // ─────────────────────────────────────────

    return sequelize.transaction(async (t) => {
      // LOCK wallets
      await buyerWallet.reload({
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      await sellerWallet.reload({
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // Prevent duplicate purchase
      const existingPurchase = await this.purchaseRepo.findByUserAndService(
        buyerUserId,
        serviceId,
        t,
      );

      if (existingPurchase) {
        throw Object.assign(new Error("You already purchased this service."), {
          name: "AlreadyPurchasedError",
        });
      }

      const buyerBalance = parseFloat(buyerWallet.availableBalance);

      if (buyerBalance < amount) {
        throw Object.assign(new Error("Insufficient balance."), {
          name: "InsufficientBalanceError",
        });
      }

      const sellerBalance = parseFloat(sellerWallet.availableBalance);

      // Shared group id
      const groupId = uuidv4();

      // ─────────────────────────────────────
      // Deduct buyer
      // ─────────────────────────────────────

      await buyerWallet.update(
        {
          availableBalance: (buyerBalance - amount).toFixed(8),
        },
        { transaction: t },
      );

      // ─────────────────────────────────────
      // Credit seller
      // ─────────────────────────────────────

      await sellerWallet.update(
        {
          availableBalance: (sellerBalance + amount).toFixed(8),
        },
        { transaction: t },
      );

      // ─────────────────────────────────────
      // Create purchase snapshot
      // ─────────────────────────────────────

      const purchase = await this.purchaseRepo.create(
        {
          userId: buyerUserId,

          serviceId: service.id,

          buyerWalletId: buyerWallet.id,

          sellerWalletId: sellerWallet.id,

          amountPaid: amount,

          status: "COMPLETED",
        },
        { transaction: t },
      );

      // ─────────────────────────────────────
      // Buyer transaction
      // ─────────────────────────────────────

      const buyerTxn = await WalletTransaction.create(
        {
          transaction_group_id: groupId,

          walletId: buyerWallet.id,

          userId: buyerUserId,

          type: "WITHDRAW",

          amount,

          currency: buyerWallet.currency,

          description: `Payment for service ${service.id}`,

          performedBy: buyerUserId,

          referenceType: "SERVICE_PURCHASE",

          referenceId: purchase.id,
        },
        { transaction: t },
      );

      // ─────────────────────────────────────
      // Seller transaction
      // ─────────────────────────────────────

      await WalletTransaction.create(
        {
          transaction_group_id: groupId,

          walletId: sellerWallet.id,

          userId: service.userId,

          receiverId: service.userId,

          type: "DEPOSIT",

          amount,

          currency: sellerWallet.currency,

          description: `Received payment for service ${service.id}`,

          performedBy: buyerUserId,

          referenceType: "SERVICE_PURCHASE",

          referenceId: purchase.id,
        },
        { transaction: t },
      );

      // Backfill txn id
      await purchase.update(
        {
          walletTransactionId: buyerTxn.id,
        },
        { transaction: t },
      );

      // Increment denormalized purchase counter on the service
      await Service.increment("purchaseCount", {
        by: 1,
        where: { id: service.id },
        transaction: t,
      });

      // TODO: if a refund flow is added, decrement purchaseCount there too

      return purchase;
    });
  }

  /**
   * Buyer: list my purchases.
   */
  async getUserPurchases(userId) {
    return this.purchaseRepo.findByUser(userId);
  }

  /**
   * Owner/admin: who bought my service.
   */
  async getServiceBuyers(serviceId) {
    return this.purchaseRepo.findByService(serviceId);
  }
}

module.exports = ServicePurchaseService;
