const ReceiptService = require("../services/ReceiptService");
const receiptService = new ReceiptService();

class ReceiptController {
  async getReceipts(req, res) {
    try {
      const { id: userId } = req.user;
      const receipts = await receiptService.getReceiptsByUserId(userId);
      return res.status(200).json({ success: true, data: receipts });
    } catch (error) {
      console.error("getReceipts error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getReceiptById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const receipt = await receiptService.getReceiptById(userId, id);
      if (!receipt) {
        return res.status(404).json({ success: false, error: "Receipt not found." });
      }

      return res.status(200).json({ success: true, data: receipt });
    } catch (error) {
      console.error("getReceiptById error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async createReceipt(req, res) {
    try {
      const { id: userId } = req.user;
      const { senderId, receiverId, amount , currency } = req.body;
      const newReceipt = await receiptService.createReceipt(userId, { senderId, receiverId, amount, currency });
      return res.status(201).json({ success: true, data: newReceipt });
    } catch (error) {
      console.error("createReceipt error:", error);
      if (error.name === "InvalidBankAccountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "SequelizeForeignKeyConstraintError") {
        return res.status(400).json({ success: false, error: "Invalid bank account reference." });
      }
      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({ success: false, error: error.message });
      }

      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async updateReceipt(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;
      const updated = await receiptService.updateReceipt(
        userId,
        id,
        updateData,
        req.user,
      );
      if (!updated) {
        return res.status(404).json({ success: false, error: "Receipt not found." });
      }

      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("updateReceipt error:", error);
      if (error.name === "InvalidBankAccountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "SequelizeForeignKeyConstraintError") {
        return res.status(400).json({ success: false, error: "Invalid bank account reference." });
      }
      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({ success: false, error: error.message });
      }

      res.status(500).json({ success: false, error: "Server erro r. Please try again later." });
    }
  }

  async deleteReceipt(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const deleted = await receiptService.deleteReceipt(userId, id);
      if (!deleted) return res.status(404).json({ success: false, error: "Receipt not found." });
      return res.status(200).json({ success: true, message: "Receipt deleted successfully." });
    } catch (error) {
      console.error("deleteReceipt error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  // admin actions for approving or rejecting receipts
  async approveReceipt(req, res) {
    try {
      const { id } = req.params;
      console.log("Approving receipt with payload:", req.body);
      // allow optional newAmount and isLock in body to override credited amount/lock behaviour
      const { newAmount, isLock } = req.body || {};
      const approved = await receiptService.approveReceipt(
        id,
        req.user,
        newAmount,
        isLock,
      );

      if (!approved) {
        return res.status(404).json({ success: false, error: "Receipt not found." });
      }

      return res.status(200).json({ success: true, data: approved });
    } catch (error) {
      console.error("approveReceipt error:", error);
      if (error.name === "UnauthorizedError") {
        return res.status(403).json({ success: false, error: "You do not have permission to approve this receipt." });
      }
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async rejectReceipt(req, res) {
    try {
      const { id } = req.params;
      const rejected = await receiptService.rejectReceipt(id, req.user);
      if (!rejected) {
        return res.status(404).json({ success: false, error: "Receipt not found." });
      }

      return res.status(200).json({ success: true, data: rejected });
    } catch (error) {
      console.error("rejectReceipt error:", error);
      if (error.name === "UnauthorizedError") {
        return res.status(403).json({ success: false, error: "You do not have permission to reject this receipt." });
      }
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async getAdminReceipts(req, res) {
    try {
      const { type } = req.query;
      const { id: userId } = req.user;
      let receipts;

      if (type === "my") {
        receipts = await receiptService.getReceiptsByUserId(userId);
      } else if (type === "all") {
        receipts = await receiptService.getAdminReceipts();
      } else {
        return res.status(400).json({ success: false, error: "Invalid type parameter. Must be 'my' or 'all'." });
      }

      return res.status(200).json({ success: true, data: receipts });
    } catch (error) {
      console.error("getAdminReceipts error:", error);
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  // Admin-only update endpoint to edit any receipt
  async adminUpdateReceipt(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updated = await receiptService.adminUpdateReceipt(id, updateData, req.user);
      if (!updated) {
        return res.status(404).json({ success: false, error: "Receipt not found." });
      }
      return res.status(200).json({ success: true, data: updated });
    } catch (error) {
      console.error("adminUpdateReceipt error:", error);
      if (error.name === "InvalidBankAccountError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === "SequelizeValidationError") {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = ReceiptController;
