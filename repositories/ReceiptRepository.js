const Receipt = require("../models/receipt");
const BankAccount = require("../models/bankAccount");
const User = require("../models/user");
const { Op } = require("sequelize");

class ReceiptRepository {
  async getReceiptsByUserId(userId) {
    return await Receipt.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        { model: User, as: 'user', attributes: ['id','firstName','lastName','email','usdWalletBalance','personalWalletBalance'] },
        { model: User, as: 'approver', attributes: ['id','firstName','lastName','email'] },
      ],
    });
  }

  async getAdminReceipts() {
    return await Receipt.findAll({
      order: [["createdAt", "DESC"]],
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        { model: User, as: 'user', attributes: ['id','firstName','lastName','email','usdWalletBalance','personalWalletBalance'] },
        { model: User, as: 'approver', attributes: ['id','firstName','lastName','email'] },
      ],
    });
  }

  async getReceiptById(userId, receiptId) {
    return await Receipt.findOne({
      where: { id: receiptId, userId },
      include: [
        { model: BankAccount, as: "sender" },
        { model: BankAccount, as: "receiver" },
        { model: User, as: 'user', attributes: ['id','firstName','lastName','email','usdWalletBalance','personalWalletBalance'] },
        { model: User, as: 'approver', attributes: ['id','firstName','lastName','email'] },
      ],
    });
  }

  async createReceipt(userId, data) {
    return await Receipt.create({ userId, ...data });
  }

  async updateReceipt(userId, receiptId, updateData) {
    const receipt = await Receipt.findOne({ where: { id: receiptId, userId } });
    if (!receipt) return null;
    await receipt.update(updateData);
    return receipt;
  }

  async deleteReceipt(userId, receiptId) {
    const deleted = await Receipt.destroy({ where: { id: receiptId, userId } });
    return deleted > 0;
  }

  async updateReceiptStatus(receiptId, status) {
    const receipt = await Receipt.findByPk(receiptId);
    if (!receipt) return null;
    await receipt.update({ status });
    return receipt;
  }
}

module.exports = ReceiptRepository;
