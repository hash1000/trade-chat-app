const ReceiptRepository = require('../repositories/ReceiptRepository');
const BankAccount = require('../models/bankAccount');

class ReceiptService {
  constructor() {
    this.receiptRepository = new ReceiptRepository();
  }

  async getReceiptsByUserId(userId) {
    return this.receiptRepository.getReceiptsByUserId(userId);
  }

  async getReceiptById(userId, receiptId) {
    return this.receiptRepository.getReceiptById(userId, receiptId);
  }

  async createReceipt(userId, data) {
    // Validate sender and receiver exist
    const { senderId, receiverId } = data;
    const sender = await BankAccount.findByPk(senderId);
    if (!sender) {
      const err = new Error('Sender bank account not found');
      err.name = 'InvalidBankAccountError';
      throw err;
    }
    const receiver = await BankAccount.findByPk(receiverId);
    if (!receiver) {
      const err = new Error('Receiver bank account not found');
      err.name = 'InvalidBankAccountError';
      throw err;
    }

    return this.receiptRepository.createReceipt(userId, data);
  }

  async updateReceipt(userId, receiptId, updateData) {
    // If sender/receiver are being changed, validate them
    if (updateData.senderId) {
      const sender = await BankAccount.findByPk(updateData.senderId);
      if (!sender) {
        const err = new Error('Sender bank account not found');
        err.name = 'InvalidBankAccountError';
        throw err;
      }
    }
    if (updateData.receiverId) {
      const receiver = await BankAccount.findByPk(updateData.receiverId);
      if (!receiver) {
        const err = new Error('Receiver bank account not found');
        err.name = 'InvalidBankAccountError';
        throw err;
      }
    }

    return this.receiptRepository.updateReceipt(userId, receiptId, updateData);
  }

  async deleteReceipt(userId, receiptId) {
    return this.receiptRepository.deleteReceipt(userId, receiptId);
  }
}

module.exports = ReceiptService;
