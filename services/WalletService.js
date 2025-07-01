const { User, Transaction } = require("../models");
const sequelize = require("../config/database");
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();

class WalletService {
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
}

module.exports = new WalletService();
