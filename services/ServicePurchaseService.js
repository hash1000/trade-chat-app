// services/ServicePurchaseService.js
const { v4: uuidv4 } = require("uuid");
const sequelize = require("../config/database");
const { Wallet, WalletTransaction } = require("../models");
const ServiceRepository = require("../repositories/ServiceRepository");
const ServicePurchaseRepository = require("../repositories/ServicePurchaseRepository");

class ServicePurchaseService {
  constructor() {
    this.serviceRepo = new ServiceRepository();
    this.purchaseRepo = new ServicePurchaseRepository();
  }

  /**
   * Purchase a service using the buyer's personal USD wallet.
   * @param {number} buyerUserId
   * @param {number} serviceId
   * @returns {Promise<ServicePurchase>}
   */
  async purchaseService(buyerUserId, serviceId) {
    // 1. Load service and validate it has a USD price
    const service = await this.serviceRepo.findByPk(serviceId);
    if (!service) {
      const err = new Error("Service not found.");
      err.name = "NotFoundError";
      throw err;
    }
    if (service.price === null || service.price === undefined) {
      const err = new Error("This service is not available for purchase.");
      err.name = "ServiceNotPurchasableError";
      throw err;
    }
    if (service.priceCurrency !== "USD") {
      const err = new Error("Only USD-priced services are supported at this time.");
      err.name = "UnsupportedCurrencyError";
      throw err;
    }

    const price = parseFloat(service.price); // safe: always stored as DECIMAL

    // 2. Prevent double-purchase (optional — remove if re-purchasing is allowed)
    const existing = await this.purchaseRepo.findByUserAndService(buyerUserId, serviceId);
    if (existing) {
      const err = new Error("You have already purchased this service.");
      err.name = "AlreadyPurchasedError";
      throw err;
    }

    // 3. Load buyer's personal USD wallet
    const wallet = await Wallet.findOne({
      where: { userId: buyerUserId, currency: "USD", walletType: "PERSONAL" },
    });
    if (!wallet) {
      const err = new Error("USD personal wallet not found.");
      err.name = "WalletNotFoundError";
      throw err;
    }

    const available = parseFloat(wallet.availableBalance);
    if (available < price) {
      const err = new Error(`Insufficient balance. Required: $${price}, Available: $${available}.`);
      err.name = "InsufficientBalanceError";
      throw err;
    }

    // 4. Wrap everything in a DB transaction for atomicity
    const purchase = await sequelize.transaction(async (t) => {
      // Deduct from wallet (optimistic lock via reload inside transaction)
      await wallet.reload({ transaction: t, lock: t.LOCK.UPDATE });

      const freshBalance = parseFloat(wallet.availableBalance);
      if (freshBalance < price) {
        const err = new Error(`Insufficient balance. Required: $${price}, Available: $${freshBalance}.`);
        err.name = "InsufficientBalanceError";
        throw err;
      }

      await wallet.update(
        { availableBalance: (freshBalance - price).toFixed(8) },
        { transaction: t }
      );

      // Create wallet transaction record
      const txn = await WalletTransaction.create(
        {
          transaction_group_id: uuidv4(),
          walletId: wallet.id,
          userId: buyerUserId,
          type: "WITHDRAW",
          amount: price,
          currency: "USD",
          description: `Purchase of service: ${service.name} (ID: ${service.id})`,
          performedBy: buyerUserId,
          meta: { serviceId: service.id, serviceName: service.name },
        },
        { transaction: t }
      );

      // Create purchase record
      const newPurchase = await this.purchaseRepo.create(
        {
          userId: buyerUserId,
          serviceId: service.id,
          walletTransactionId: txn.id,
          amountPaid: price,
          currency: "USD",
          status: "COMPLETED",
        },
        { transaction: t } // ← pass to repo below
      );

      // NOTE: if your repo's create() doesn't accept sequelize transaction options,
      // call ServicePurchase.create({...}, { transaction: t }) directly here.
      // Adjust based on your repo.create() signature.

      return newPurchase;
    });

    return purchase;
  }

  async getUserPurchases(userId) {
    return this.purchaseRepo.findByUser(userId);
  }
}

module.exports = ServicePurchaseService;