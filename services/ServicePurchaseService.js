// services/ServicePurchaseService.js
const { v4: uuidv4 } = require("uuid");
const sequelize = require("../config/database");
const { Wallet, WalletTransaction } = require("../models");
const ServiceRepository         = require("../repositories/ServiceRepository");
const ServicePurchaseRepository = require("../repositories/ServicePurchaseRepository");

class ServicePurchaseService {
  constructor() {
    this.serviceRepo  = new ServiceRepository();
    this.purchaseRepo = new ServicePurchaseRepository();
  }

  async purchaseService(buyerUserId, serviceId) {

    // ─── 1. Load & validate service ───────────────────────────────────────────
    const service = await this.serviceRepo.findByPk(serviceId);
    if (!service) {
      throw Object.assign(new Error("Service not found."), { name: "NotFoundError" });
    }
    if (service.price === null || service.price === undefined) {
      throw Object.assign(new Error("This service is not available for purchase."), { name: "ServiceNotPurchasableError" });
    }
    if (service.priceCurrency !== "USD") {
      throw Object.assign(new Error("Only USD-priced services are supported."), { name: "UnsupportedCurrencyError" });
    }

    // Guard: buyer cannot purchase their own service
    if (service.userId === buyerUserId) {
      throw Object.assign(new Error("You cannot purchase your own service."), { name: "SelfPurchaseError" });
    }

    const price = parseFloat(service.price);

    // ─── 2. Prevent double purchase ───────────────────────────────────────────
    const existing = await this.purchaseRepo.findByUserAndService(buyerUserId, serviceId);
    if (existing) {
      throw Object.assign(new Error("You have already purchased this service."), { name: "AlreadyPurchasedError" });
    }

    // ─── 3. Load both wallets (outside tx — just existence checks) ────────────
    const buyerWallet = await Wallet.findOne({
      where: { userId: buyerUserId, currency: "USD", walletType: "PERSONAL" },
    });
    if (!buyerWallet) {
      throw Object.assign(new Error("Your USD personal wallet was not found."), { name: "WalletNotFoundError" });
    }

    const ownerWallet = await Wallet.findOne({
      where: { userId: service.userId, currency: "USD", walletType: "PERSONAL" },
    });
    if (!ownerWallet) {
      throw Object.assign(new Error("Service owner does not have a USD wallet. Purchase cannot be completed."), { name: "OwnerWalletNotFoundError" });
    }

    // Pre-check before entering the DB transaction
    if (parseFloat(buyerWallet.availableBalance) < price) {
      throw Object.assign(
        new Error(`Insufficient balance. Required: $${price}, Available: $${buyerWallet.availableBalance}.`),
        { name: "InsufficientBalanceError" }
      );
    }

    // ─── 4. Atomic block — all five operations succeed or none do ─────────────
    return sequelize.transaction(async (t) => {

      // Re-read BOTH wallets with row locks to prevent race conditions
      await buyerWallet.reload({ transaction: t, lock: t.LOCK.UPDATE });
      await ownerWallet.reload({ transaction: t, lock: t.LOCK.UPDATE });

      const buyerBalance = parseFloat(buyerWallet.availableBalance);
      if (buyerBalance < price) {
        throw Object.assign(
          new Error(`Insufficient balance. Required: $${price}, Available: $${buyerBalance}.`),
          { name: "InsufficientBalanceError" }
        );
      }

      const ownerBalance = parseFloat(ownerWallet.availableBalance);
      const groupId      = uuidv4(); // same group ID ties both transactions together

      // ── 4a. Deduct from buyer wallet ────────────────────────────────────────
      await buyerWallet.update(
        { availableBalance: (buyerBalance - price).toFixed(8) },
        { transaction: t }
      );

      // ── 4b. Credit to owner wallet ──────────────────────────────────────────
      await ownerWallet.update(
        { availableBalance: (ownerBalance + price).toFixed(8) },
        { transaction: t }
      );

      // ── 4c. Create purchase record (need its ID before creating transactions) ─
      const purchase = await this.purchaseRepo.create(
        {
          userId:    buyerUserId,
          serviceId: service.id,
          amountPaid: price,
          currency:  "USD",
          status:    "COMPLETED",
          // walletTransactionId back-filled in step 4e
        },
        { transaction: t }
      );

      // ── 4d. Buyer WITHDRAW transaction ──────────────────────────────────────
      const buyerTxn = await WalletTransaction.create(
        {
          transaction_group_id: groupId,
          walletId:      buyerWallet.id,
          userId:        buyerUserId,
          type:          "WITHDRAW",
          amount:        price,
          currency:      "USD",
          description:   `Payment for service: ${service.name} (ID: ${service.id})`,
          performedBy:   buyerUserId,
          referenceType: "SERVICE_PURCHASE",
          referenceId:   purchase.id,
          meta: {
            serviceId:    service.id,
            serviceName:  service.name,
            ownerUserId:  service.userId,
          },
        },
        { transaction: t }
      );

      // ── 4e. Owner DEPOSIT transaction ────────────────────────────────────────
      await WalletTransaction.create(
        {
          transaction_group_id: groupId,           // same group — links debit & credit
          walletId:      ownerWallet.id,
          userId:        service.userId,            // owner is the wallet holder
          receiverId:    service.userId,
          type:          "DEPOSIT",
          amount:        price,
          currency:      "USD",
          description:   `Payment received for service: ${service.name} (ID: ${service.id})`,
          performedBy:   buyerUserId,              // buyer triggered this
          referenceType: "SERVICE_PURCHASE",
          referenceId:   purchase.id,
          meta: {
            serviceId:   service.id,
            serviceName: service.name,
            buyerUserId,
          },
        },
        { transaction: t }
      );

      // ── 4f. Back-fill buyer's wallet transaction ID on the purchase record ───
      await purchase.update(
        { walletTransactionId: buyerTxn.id },
        { transaction: t }
      );

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