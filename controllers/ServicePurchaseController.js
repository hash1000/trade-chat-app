// controllers/ServicePurchaseController.js
const ServicePurchaseService = require("../services/ServicePurchaseService");
const purchaseService = new ServicePurchaseService();

class ServicePurchaseController {
  async purchase(req, res) {
    try {
      const buyerUserId = req.user.id; // set by authMiddleware
      const serviceId = Number(req.params.id);

      const purchase = await purchaseService.purchaseService(buyerUserId, serviceId);

      return res.status(201).json({ success: true, data: purchase });
    } catch (error) {
      console.error("ServicePurchaseController.purchase error:", error);

      const clientErrors = new Set([
        "NotFoundError",
        "ServiceNotPurchasableError",
        "UnsupportedCurrencyError",
        "AlreadyPurchasedError",
        "WalletNotFoundError",
        "InsufficientBalanceError",
      ]);

      if (clientErrors.has(error.name)) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }

  async myPurchases(req, res) {
    try {
      const userId = req.user.id;
      const purchases = await purchaseService.getUserPurchases(userId);
      return res.status(200).json({ success: true, data: purchases });
    } catch (error) {
      console.error("ServicePurchaseController.myPurchases error:", error);
      return res.status(500).json({ success: false, error: "Server error. Please try again later." });
    }
  }
}

module.exports = ServicePurchaseController;