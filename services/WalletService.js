const { User, Transaction } = require("../models");
const sequelize = require("../config/database");
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();
const CurrencyService = require("./CurrencyService");
const currencyService = new CurrencyService();
const Wallet = require("../models/wallet");
const WalletTransaction = require("../models/walletTransaction");

class WalletService {
    constructor() {
    // If you later introduce a CurrencyRepository, initialize it here
  }
    async getUserWalletById(userId) {
        return User.findByPk(userId);
    }

    async updateCustomerId(user, customerId) {
        console.log("user,customerId", user, customerId);
        return await userRepository.update(user.id, { stripeCustomerId: customerId });
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

    async getOrCreateWallet(userId, currency, walletType = "PERSONAL", transaction) {
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

    async deposit({ userId, currency, amount, walletType = "PERSONAL", receiptId = null, meta = {} }) {
        return sequelize.transaction(async (t) => {
            const wallet = await this.getOrCreateWallet(userId, currency, walletType, t);

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

    async lockFunds({ userId, currency, amount, walletType = "PERSONAL", receiptId = null, meta = {} }) {
        return sequelize.transaction(async (t) => {
            const wallet = await this.getOrCreateWallet(userId, currency, walletType, t);

            const available = Number(wallet.availableBalance) || 0;
            console.log("available", available);
            const lockAmount = Number(amount);
            console.log("lockAmount", lockAmount);

            if (available < lockAmount) {
                throw new Error("Insufficient available balance");
            }

            const beforeAvailable = available;
            console.log("beforeAvailable", beforeAvailable);
            const beforeLocked = Number(wallet.lockedBalance) || 0;

            const afterAvailable = beforeAvailable - lockAmount;
            const afterLocked = beforeLocked + lockAmount;
console.log("afterAvailable", afterAvailable);
console.log("afterLocked", afterLocked);
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
                    meta: { ...meta, lockedBefore: beforeLocked, lockedAfter: afterLocked },
                },
                t,
            );

            return wallet;
        });
    }

    async unlockFunds({ userId, currency, amount, walletType = "PERSONAL", receiptId = null, meta = {} }) {
        return sequelize.transaction(async (t) => {
            const wallet = await this.getOrCreateWallet(userId, currency, walletType, t);

            const locked = Number(wallet.lockedBalance) || 0;
            const unlockAmount = Number(amount);

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
                    amount,
                    currency,
                    balanceBefore: beforeAvailable,
                    balanceAfter: afterAvailable,
                    receiptId,
                    meta: { ...meta, lockedBefore: beforeLocked, lockedAfter: afterLocked },
                },
                t,
            );

            return wallet;
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
                    throw new Error('Invalid amount to convert');
                }

                const user = await User.findByPk(userId, { transaction });
                if (!user) throw new Error('User not found');

                const currentUsdBalance = Number(user.usdWalletBalance) || 0;
                const convertAmount = Number(usdAmount);
                if (currentUsdBalance < convertAmount) {
                    throw new Error('Insufficient USD wallet balance');
                }

                // Get current USD -> CNY rate
                // const rate = await currencyService.getCurrentRate('USD', 'CNY');
                 const converted = convertAmount / Number(rate);

                // Update balances
                const newUsdBalance = currentUsdBalance - convertAmount;
                const newPersonalBalance = (Number(user.personalWalletBalance) || 0) + rate;

                await user.update({ usdWalletBalance: newUsdBalance, personalWalletBalance: newPersonalBalance }, { transaction });

                // Create a transaction record for audit
                await Transaction.create({
                    orderId: `conversion-${Date.now()}`,
                    userId: user.id,
                    amount: rate,
                    usdAmount: convertAmount,
                    rate: Number(rate),
                    currency: 'CNY',
                    type: 'conversion',
                    status: 'completed',
                    paymentMethod: 'conversion',
                    metadata: { note: 'USD->CNY conversion' },
                }, { transaction });

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
