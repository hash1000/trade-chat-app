const Receipt = require("../models/receipt");
const BankAccount = require("../models/bankAccount");
const User = require("../models/user");
const { Op } = require("sequelize");
const WalletTransaction = require("../models/walletTransaction");
const Wallet = require("../models/wallet");

class ReceiptRepository {
  async getReceiptsByUserId(userId) {
    return await Receipt.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "username",
            "lastName",
            "email",
            "usdWalletBalance",
            "personalWalletBalance",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
        },
        {
          model: WalletTransaction,
          as: "walletTransactions",
          include: [
            {
                model: Wallet,
                as: "wallet",
              },
            {
              model: User,
              as: "performer",
              attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
            },
          ],
        },
      ],
    });
  }

  async getAdminReceipts({ pagination = false, page = 1, limit = 20, status = "all" } = {}) {
    const where = {};
    if (status === "locked") {
      where.isLock = true;
    } else if (status && status !== "all") {
      where.status = status;
    }

    const queryOptions = {
      where,
      order: [["createdAt", "DESC"]],
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "usdWalletBalance",
            "personalWalletBalance",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
        },
        {
          model: WalletTransaction,
          as: "walletTransactions",
          include: [
            {
                model: Wallet,
                as: "wallet",
              },
            {
              model: User,
              as: "performer",
              attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
            },
          ],
        },
      ],
    };

    if (!pagination) {
      return await Receipt.findAll(queryOptions);
    }

    const { count, rows } = await Receipt.findAndCountAll({
      ...queryOptions,
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });

    return {
      receipts: rows,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    };
  }

  async getReceiptById(userId, receiptId) {
    return await Receipt.findOne({
      where: { id: receiptId, userId },
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "usdWalletBalance",
            "personalWalletBalance",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
        },
        {
          model: WalletTransaction,
          as: "walletTransactions",
          include: [
            {
                model: Wallet,
                as: "wallet",
              },
            {
              model: User,
              as: "performer",
              attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
            },
          ],
        },
      ],
    });
  }

  async getReceiptByPk(receiptId) {
    return await Receipt.findByPk(receiptId, {
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "username",
            "email",
            "usdWalletBalance",
            "personalWalletBalance",
            "profilePic",
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
        },
        {
          model: WalletTransaction,
          as: "walletTransactions",
          include: [
            {
                model: Wallet,
                as: "wallet",
              },
            {
              model: User,
              as: "performer",
              attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
            },
          ],
        },
      ],
    });
  }

  async findReceiptById(receiptId) {
    return await Receipt.findOne({
      where: { id: receiptId },
    });
  }

  async createReceipt(userId, data) {
    console.log("Creating receipt for user", userId, data);
    return await Receipt.create({ userId, ...data });
  }

  async updateReceipt(userId, receiptId, updateData) {
    const receipt = await Receipt.findOne({ where: { id: receiptId, userId } });
    if (!receipt) return null;
    await receipt.update(updateData);
    return receipt;
  }

  async update(receiptId, updateData) {
    console.log("Updating receipt", receiptId, updateData);
    const receipt = await Receipt.findOne({ where: { id: receiptId } });
    if (!receipt) return null;
    await receipt.update(updateData);
    console.log("jhksdhkdfh");
    return receipt;
  }

  async deleteReceipt(userId, receiptId) {
    const deleted = await Receipt.destroy({ where: { id: receiptId, userId } });
    return deleted > 0;
  }

  async adminDeleteReceipt(receiptId) {
    const deleted = await Receipt.destroy({ where: { id: receiptId } });
    return deleted > 0;
  }

  async adminBulkDeleteReceipts(receiptIds) {
    return await Receipt.destroy({ where: { id: { [Op.in]: receiptIds } } });
  }

  async updateReceiptStatus(receiptId, status) {
    const receipt = await Receipt.findByPk(receiptId);
    if (!receipt) return null;
    await receipt.update({ status });
    return receipt;
  }
}

module.exports = ReceiptRepository;
