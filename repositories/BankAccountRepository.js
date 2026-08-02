const BankAccount = require("../models/bankAccount");
const { Op, literal } = require("sequelize");
const Wallet = require("../models/wallet");
const BankAccountWallet = require("../models/bankAccountWallet");
const Address = require("../models/address");

class BankAccountRepository {
  // classification may be 'sender', 'receiver', 'both' or 'all' (or undefined)
  async getBankAccountsByUserId(userId, classification, filters = {}) {
    const where = { userId };

    if (classification && classification !== "all") {
      const allowed = ["sender", "receiver", "both"];

      if (allowed.includes(classification)) {
        where.classification = classification;
      }
    }

    if (filters.isDefault !== undefined) {
      where.isDefault = filters.isDefault;
    }

    if (filters.walletType !== undefined) {
      where.walletType = filters.walletType;
    }

    return await BankAccount.findAll({
      where,
      include: [
        {
          model: Wallet,
          as: "wallets",
          required: false,
          through: { attributes: [] },
        },
        {
          model: Address,
          as: "address",
          required: false,
          where: { type: "company" },
        },
      ],
      order: [["sequence", "ASC"]],
    });
  }

  async getBankAccountById(userId, accountId) {
    return await BankAccount.findOne({
      where: { id: accountId, userId },
      include: [
        {
          model: Wallet,
          as: "wallets",
          required: false,
          through: { attributes: [] },
        },
        {
          model: Address,
          as: "address",
          required: false,
        },
      ],
    });
  }

  async getAnyBankAccountById(accountId) {
    return await BankAccount.findByPk(accountId, {
      include: [
        {
          model: Wallet,
          as: "wallets",
        },
        {
          model: Address,
          as: "address",
          required: false,
          where: { type: "company" },
        },
      ],
    });
  }

  async getAllTestCards() {
    const where = { testCard: true };

    return await BankAccount.findAll({
      where,
      order: [
        ["currency", "ASC"],
        ["sequence", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async getTestCards(currency) {
    const where = { testCard: true };

    if (currency) {
      // MySQL JSON_CONTAINS
      where.currency = literal(`JSON_CONTAINS(currency, '["${currency}"]')`);
    }

    return await BankAccount.findAll({
      where,
      order: [
        ["currency", "ASC"],
        ["sequence", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  async getTestCardByCurrency(
    currency,
    excludeAccountId = null,
    userId = null,
  ) {
    const where = { testCard: true, currency, userId };

    if (excludeAccountId) {
      where.id = { [Op.ne]: excludeAccountId };
    }
    console.log("Searching for test card with criteria:", where);
    return await BankAccount.findOne({
      where,
      order: [["id", "ASC"]],
    });
  }

  async getTestCardByCurrency(currency) {
    const where = { testCard: true, currency };
    return await BankAccount.findOne({
      where,
      order: [["id", "ASC"]],
    });
  }

  async createBankAccount(userId, accountData) {
    const lastAccount = await BankAccount.findOne({
      where: { userId },
      order: [["sequence", "DESC"]],
    });

    const nextSequence = lastAccount ? lastAccount.sequence + 1 : 1;

    return await BankAccount.create({
      userId,
      ...accountData,
      sequence: nextSequence,
    });
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

  async updateAnyBankAccount(accountId, updateData) {
    const account = await BankAccount.findByPk(accountId);
    if (!account) return null;

    const safeUpdateData = { ...updateData };
    delete safeUpdateData.sequence;
    delete safeUpdateData.userId;
    delete safeUpdateData.id;
    delete safeUpdateData.createdAt;
    delete safeUpdateData.updatedAt;

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

  // ── Wallet linking (pure DB, no business logic) ──────────────────────────

  async findWalletByTypeAndCurrency(userId, type, currency) {
    return await Wallet.findOne({
      where: { userId, walletType: type, currency },
    });
  }

  async findWalletsByType(userId, walletType) {
    return await Wallet.findAll({
      where: { userId, walletType },
    });
  }

  //  BankAccountWallet is the join table that tracks wallet links, allowing us to enforce the wallet limit per bank account
  async countLinkedWallets(bankAccountId) {
    return BankAccountWallet.count({
      where: { bankAccountId },
    });
  }

  async findBankAccountWalletByWalletId(walletId) {
    return BankAccountWallet.findOne({
      where: { walletId },
    });
  }

  async findBankAccountWalletsByWalletIds(walletIds) {
    return await BankAccountWallet.findAll({
      where: { walletId: { [Op.in]: walletIds } },
    });
  }

  // manual join since BankAccountWallet has no declared association to Wallet
  async findBankAccountWalletsWithWallet(bankAccountId) {
    const links = await BankAccountWallet.findAll({ where: { bankAccountId } });
    if (!links.length) return [];

    const wallets = await Wallet.findAll({
      where: { id: links.map((link) => link.walletId) },
    });
    const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));

    return links.map((link) => ({
      ...link.get({ plain: true }),
      wallet: walletsById.get(link.walletId) || null,
    }));
  }

  async createBankAccountWallet(bankAccountId, walletId) {
    return await BankAccountWallet.create({
      bankAccountId,
      walletId,
    });
  }

  async createBankAccountWallets(bankAccountId, walletIds) {
    return await BankAccountWallet.bulkCreate(
      walletIds.map((walletId) => ({ bankAccountId, walletId })),
    );
  }

  async deleteBankAccountWallet(bankAccountId) {
    return await BankAccountWallet.destroy({
      where: { bankAccountId },
    });
  }

  async deleteBankAccountWalletsByWalletIds(walletIds) {
    return await BankAccountWallet.destroy({
      where: { walletId: { [Op.in]: walletIds } },
    });
  }

  async findBankAccountByWalletId(walletId) {
    return await Wallet.findByPk(walletId, {
      include: [
        {
          model: BankAccount,
          as: "bankAccounts",
        },
      ],
    });
  }
}

module.exports = BankAccountRepository;
