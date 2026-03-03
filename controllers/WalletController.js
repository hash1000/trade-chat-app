const WalletService = require("../services/WalletService");
const walletService = new WalletService();

class WalletController {
  async createWallet(req, res) {
    try {
      const { id: userId } = req.user;
      const { currency, walletType } = req.body || {};

      if (!currency || typeof currency !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "currency is required" });
      }

      const normalizedCurrency = currency.trim().toUpperCase();
      if (normalizedCurrency.length !== 3) {
        return res.status(400).json({
          success: false,
          error: "currency must be a 3-letter code (e.g. EUR, USD, BBD)",
        });
      }

      const normalizedWalletType = walletType
        ? String(walletType).trim().toUpperCase()
        : "PERSONAL";
      if (!["PERSONAL", "COMPANY"].includes(normalizedWalletType)) {
        return res.status(400).json({
          success: false,
          error: "walletType must be PERSONAL or COMPANY",
        });
      }

      const result = await walletService.createWallet(
        userId,
        normalizedCurrency,
        normalizedWalletType,
      );

      return res.status(201).json({
        success: true,
        created: result.created,
        data: result.wallet,
      });
    } catch (error) {
      console.error("createWallet error:", error);
      return res.status(500).json({
        success: false,
        error: "Server error. Please try again later.",
      });
    }
  }

  async convertUsdToCny(req, res) {
    try {
      const { id: userId } = req.user;
      const { amount ,rate } = req.body;

      const parsed = Number(amount);
      if (!amount || Number.isNaN(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount provided.' });
      }

      const result = await walletService.convertUsdToCny(userId, parsed, rate);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('convertUsdToCny error:', error);
      if (error.message && error.message.includes('Insufficient')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      if (error.message && error.message.includes('Invalid amount')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      return res.status(500).json({ success: false, error: 'Server error. Please try again later.' });
    }
  }
}

module.exports = new WalletController();
