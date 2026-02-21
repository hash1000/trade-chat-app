const ReceiptRepository = require("../repositories/ReceiptRepository");
const BankAccount = require("../models/bankAccount");
const UserService = require("./UserService");
const userService = new UserService();
class ReceiptService {
  constructor() {
    this.receiptRepository = new ReceiptRepository();
  }

  async getReceiptsByUserId(userId) {
    return this.receiptRepository.getReceiptsByUserId(userId);
  }

  async getAdminReceipts() {
    return this.receiptRepository.getAdminReceipts();
  }

  async getReceiptById(userId, receiptId) {
    return this.receiptRepository.getReceiptById(userId, receiptId);
  }

  async createReceipt(userId, data) {
    // Validate sender and receiver exist
    const { senderId, receiverId } = data;
    const sender = await BankAccount.findByPk(senderId);
    if (!sender) {
      const err = new Error("Sender bank account not found");
      err.name = "InvalidBankAccountError";
      throw err;
    }
    const receiver = await BankAccount.findByPk(receiverId);
    if (!receiver) {
      const err = new Error("Receiver bank account not found");
      err.name = "InvalidBankAccountError";
      throw err;
    }

    return this.receiptRepository.createReceipt(userId, data);
  }

  async updateReceipt(userId, receiptId, updateData) {
    // If sender/receiver are being changed, validate them
    if (updateData.senderId) {
      const sender = await BankAccount.findByPk(updateData.senderId);
      if (!sender) {
        const err = new Error("Sender bank account not found");
        err.name = "InvalidBankAccountError";
        throw err;
      }
    }
    if (updateData.receiverId) {
      const receiver = await BankAccount.findByPk(updateData.receiverId);
      if (!receiver) {
        const err = new Error("Receiver bank account not found");
        err.name = "InvalidBankAccountError";
        throw err;
      }
    }

    return this.receiptRepository.updateReceipt(userId, receiptId, updateData);
  }

  async deleteReceipt(userId, receiptId) {
    return this.receiptRepository.deleteReceipt(userId, receiptId);
  }

  async approveReceipt(receiptId) {
    // Update receipt status to 'approved'
    const approved = await this.receiptRepository.updateReceiptStatus(
      receiptId,
      "approved",
    );

    // Fetch the user's profile
    const user = await userService.getUserById(approved.userId);
    // Update the user's profile with the new USD wallet balance
    await userService.updateUserProfile(user, {
      usdWalletBalance: approved.amount,
    });

    return approved;
  }

  async rejectReceipt(receiptId) {
    return this.receiptRepository.updateReceiptStatus(receiptId, "rejected");
  }
}

module.exports = ReceiptService;
