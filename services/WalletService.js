const { User, Transaction } = require("../models");
const sequelize = require("../config/database");
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();
const CurrencyService = require("./CurrencyService");
const currencyService = new CurrencyService();

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
