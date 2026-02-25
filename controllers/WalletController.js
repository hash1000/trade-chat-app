const walletService = require('../services/WalletService');

class WalletController {
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
