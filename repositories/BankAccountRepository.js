const BankAccount = require("../models/bankAccount");
const { Op } = require("sequelize");

class BankAccountRepository {
  // classification may be 'sender', 'receiver', 'both' or 'all' (or undefined)
  async getBankAccountsByUserId(userId, classification) {
    const where = { userId };

    if (classification && classification !== "all") {
      // only include valid values
      const allowed = ["sender", "receiver", "both"];
      if (allowed.includes(classification)) {
        where.classification = classification;
      }
    }

    return await BankAccount.findAll({
      where,
      order: [["sequence", "ASC"]],
    });
  }

  async getBankAccountById(userId, accountId) {
    return await BankAccount.findOne({
      where: { id: accountId, userId },
    });
  }

  async getAnyBankAccountById(accountId) {
    return await BankAccount.findByPk(accountId);
  }

  async getAllTestCards(options = {}) {
    const { transaction } = options;

    return await BankAccount.findAll({
      where: { testCard: true },
      order: [
        ["currency", "ASC"],
        ["sequence", "ASC"],
        ["id", "ASC"],
      ],
      transaction,
    });
  }

  async createBankAccount(userId, accountData, options = {}) {
    const { transaction } = options;
    const lastAccount = await BankAccount.findOne({
      where: { userId },
      order: [["sequence", "DESC"]],
      transaction,
    });

    const nextSequence = lastAccount ? lastAccount.sequence + 1 : 1;

    return await BankAccount.create({
      userId,
      ...accountData,
      sequence: nextSequence,
    }, { transaction });
  }

  async updateBankAccount(userId, accountId, updateData) {
    const account = await BankAccount.findOne({
      where: { id: accountId, userId },
    });
    if (!account) return null;

    const safeUpdateData = { ...updateData };
    delete safeUpdateData.sequence;
    delete safeUpdateData.userId;
    delete safeUpdateData.testCard;

    await account.update(safeUpdateData);
    return account;
  }

  async updateAnyBankAccount(accountId, updateData, options = {}) {
    const { transaction } = options;
    const account = await BankAccount.findByPk(accountId, { transaction });
    if (!account) return null;

    const safeUpdateData = { ...updateData };
    delete safeUpdateData.sequence;
    delete safeUpdateData.userId;
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.updatedAt;

    await account.update(safeUpdateData, { transaction });
    return account;
  }

  async deleteBankAccount(userId, accountId) {
    const transaction = await BankAccount.sequelize.transaction();

    try {
      const accountToDelete = await BankAccount.findOne({
        where: { id: accountId, userId },
        transaction,
      });

      if (!accountToDelete) {
        await transaction.rollback();
        return null;
      }

      const deletedSequence = accountToDelete.sequence;

      await BankAccount.destroy({
        where: { id: accountId, userId },
        transaction,
      });

      await BankAccount.update(
        { sequence: BankAccount.sequelize.literal("sequence - 1") },
        {
          where: { userId, sequence: { [Op.gt]: deletedSequence } },
          transaction,
        },
      );

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reorderBankAccount(userId, accountId, newPosition) {
    const transaction = await BankAccount.sequelize.transaction();

    try {
      const accountToMove = await BankAccount.findOne({
        where: { id: accountId, userId },
        transaction,
      });

      if (!accountToMove) {
        await transaction.rollback();
        return null;
      }

      const currentPosition = accountToMove.sequence;

      if (currentPosition === newPosition) {
        await transaction.commit();
        return this.getBankAccountsByUserId(userId);
      }

      if (newPosition < currentPosition) {
        await BankAccount.update(
          { sequence: BankAccount.sequelize.literal("sequence + 1") },
          {
            where: {
              userId,
              sequence: { [Op.between]: [newPosition, currentPosition - 1] },
            },
            transaction,
          },
        );
      } else {
        await BankAccount.update(
          { sequence: BankAccount.sequelize.literal("sequence - 1") },
          {
            where: {
              userId,
              sequence: { [Op.between]: [currentPosition + 1, newPosition] },
            },
            transaction,
          },
        );
      }

      await accountToMove.update({ sequence: newPosition }, { transaction });
      await transaction.commit();

      return this.getBankAccountsByUserId(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = BankAccountRepository;
