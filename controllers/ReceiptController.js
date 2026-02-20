const ReceiptService = require("../services/ReceiptService");
const receiptService = new ReceiptService();

class ReceiptController {
  async getReceipts(req, res) {
    try {
      const { id: userId } = req.user;
      const receipts = await receiptService.getReceiptsByUserId(userId);
      return res.status(200).json({
        success: true,
        data: receipts,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server Error" });
    }
  }

  async getReceiptById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const receipt = await receiptService.getReceiptById(userId, id);
      if (!receipt) return res.status(404).json({ error: "Receipt not found", data: null });

      return res.status(200).json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server Error" });
    }
  }

  async createReceipt(req, res) {
    try {
      const { id: userId } = req.user;
      const { senderId, receiverId, amount } = req.body;
      console.log("Creating receipt with data:", req.body);
      const newReceipt = await receiptService.createReceipt(userId, {
        senderId,
        receiverId,
        amount,
      });
      return res.status(201).json({ success: true, data: newReceipt });
    } catch (error) {
      console.error(error);
      if (error.name === 'InvalidBankAccountError') {
        return res.status(400).json({ success: false, error: error.message });
      }
      // handle DB foreign key errors as a fallback
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ success: false, error: 'Invalid bank account reference' });
      }
      res.status(500).json({ error: "Server Error" });
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
      );
      if (!updated) return res.status(404).json({ success: false, error: "Receipt not found" });
      return res.json({ success: true, data: updated });
    } catch (error) {
      console.error(error);
      if (error.name === 'InvalidBankAccountError') {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ success: false, error: 'Invalid bank account reference' });
      }
      res.status(500).json({ error: "Server Error" });
    }
  }

  async deleteReceipt(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const deleted = await receiptService.deleteReceipt(userId, id);
      if (!deleted) return res.status(404).json({ error: "Receipt not found" });
  res.json({ success: true, message: "Receipt deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Server Error" });
    }
  }
}

module.exports = ReceiptController;
