const BankAccount = require('../models/bankAccount');
const { Op } = require('sequelize');

class BankAccountRepository {
  async getBankAccountsByUserId(userId) {
    return await BankAccount.findAll({
      where: { userId },
      order: [['sequence', 'ASC']],
    });
  }

  async getBankAccountById(userId, accountId) {
    return await BankAccount.findOne({
      where: { id: accountId, userId },
    });
  }

  async createBankAccount(userId, accountData) {
    const lastAccount = await BankAccount.findOne({
      where: { userId },
      order: [['sequence', 'DESC']],
    });

    const nextSequence = lastAccount ? lastAccount.sequence + 1 : 1;

    return await BankAccount.create({
      userId,
      ...accountData,
      sequence: nextSequence,
    });
  }

  async updateBankAccount(userId, accountId, updateData) {
    const account = await BankAccount.findOne({ where: { id: accountId, userId } });
    if (!account) return null;

    const { sequence, ...safeUpdateData } = updateData; // prevent manual sequence edits
    await account.update(safeUpdateData);
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

      await BankAccount.destroy({ where: { id: accountId, userId }, transaction });

      await BankAccount.update(
        { sequence: BankAccount.sequelize.literal('sequence - 1') },
        {
          where: { userId, sequence: { [Op.gt]: deletedSequence } },
          transaction,
        }
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
          { sequence: BankAccount.sequelize.literal('sequence + 1') },
          {
            where: { userId, sequence: { [Op.between]: [newPosition, currentPosition - 1] } },
            transaction,
          }
        );
      } else {
        await BankAccount.update(
          { sequence: BankAccount.sequelize.literal('sequence - 1') },
          {
            where: { userId, sequence: { [Op.between]: [currentPosition + 1, newPosition] } },
            transaction,
          }
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
