const Receipt = require('../models/receipt');
const BankAccount = require('../models/bankAccount');
const { Op } = require('sequelize');

class ReceiptRepository {
  async getReceiptsByUserId(userId) {
    return await Receipt.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        { model: BankAccount, as: 'sender' },
        { model: BankAccount, as: 'receiver' },
      ],
    });
  }

  async getReceiptById(userId, receiptId) {
    return await Receipt.findOne({
      where: { id: receiptId, userId },
      include: [
        { model: BankAccount, as: 'sender' },
        { model: BankAccount, as: 'receiver' },
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
}

module.exports = ReceiptRepository;
