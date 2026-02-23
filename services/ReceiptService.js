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

  async updateReceipt(userId, receiptId, updateData, approverUser = null) {
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

    // Fetch current receipt to detect transitions
    const current = await this.receiptRepository.getReceiptById(userId, receiptId);
    if (!current) return null;

    const wasApproved = current.type === 'approved' || current.status === 'approved';
    const willBeApproved = (updateData.type && updateData.type === 'approved') || (updateData.status && updateData.status === 'approved');

    // If approving now (and wasn't approved before), record approver if provided.
    // Authorization is enforced by the `authorize` middleware on the route.
    if (willBeApproved && !wasApproved) {
      if (approverUser && approverUser.id) {
        updateData.approvedBy = approverUser.id;
      }
    }

    const updated = await this.receiptRepository.updateReceipt(userId, receiptId, updateData);

    // After updating, if we've just approved, credit the user's usdWalletBalance
    if (willBeApproved && !wasApproved && updated) {
      // compute amount to credit: prefer newAmount when present
      const amountToCredit = updated.newAmount && Number(updated.newAmount) > 0 ? Number(updated.newAmount) : Number(updated.amount);
      if (amountToCredit && amountToCredit > 0) {
        // load the user and increment usdWalletBalance
        const User = require('../models/user');
        const targetUser = await User.findByPk(updated.userId);
        if (targetUser) {
          const currentBalance = Number(targetUser.usdWalletBalance) || 0;
          targetUser.usdWalletBalance = currentBalance + amountToCredit;
          await targetUser.save();
        }
      }
    }

    return updated;
  }

  async deleteReceipt(userId, receiptId) {
    return this.receiptRepository.deleteReceipt(userId, receiptId);
  }

  async approveReceipt(receiptId, approverUser = null, newAmount = null) {
    // fetch receipt
    const receipt = await this.receiptRepository.updateReceiptStatus(
      receiptId,
      "approved",
    );
    if (!receipt) return null;

    // record approver identity (authorization handled by route middleware)
    if (approverUser && approverUser.id) {
      await receipt.update({ approvedBy: approverUser.id });
    }

    // If caller provided a newAmount in the API call, persist it and prefer it when crediting
    if (newAmount !== null && newAmount !== undefined) {
      // try to parse numeric
      const parsed = Number(newAmount);
      if (!Number.isNaN(parsed)) {
        await receipt.update({ newAmount: parsed });
        receipt.newAmount = parsed;
      }
    }

    // compute amount to credit (prefer receipt.newAmount when present)
    const amountToCredit = receipt.newAmount && Number(receipt.newAmount) > 0 ? Number(receipt.newAmount) : Number(receipt.amount);
    if (amountToCredit && amountToCredit > 0) {
      const user = await userService.getUserById(receipt.userId);
      if (user) {
        const newBalance = (Number(user.usdWalletBalance) || 0) + amountToCredit;
        await userService.updateUserProfile(user, { usdWalletBalance: newBalance });
      }
    }

    return receipt;
  }

  async rejectReceipt(receiptId, approverUser = null) {
    const receipt = await this.receiptRepository.updateReceiptStatus(receiptId, "rejected");
    if (!receipt) return null;
    // If approver provided, set approvedBy
    if (approverUser && approverUser.id) {
      await receipt.update({ approvedBy: approverUser.id });
    }
    return receipt;
  }
}

module.exports = ReceiptService;
