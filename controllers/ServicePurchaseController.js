// controllers/ServicePurchaseController.js
const ServicePurchaseService = require("../services/ServicePurchaseService");

const purchaseService = new ServicePurchaseService();

const CLIENT_ERRORS = new Set([
  "NotFoundError",
  "ServiceNotPurchasableError",
  "UnsupportedCurrencyError",
  "SelfPurchaseError",
  "AlreadyPurchasedError",
  "WalletNotFoundError",
  "OwnerWalletNotFoundError",
  "InsufficientBalanceError",
]);

class ServicePurchaseController {
  async purchase(req, res) {
    try {
      const { id: buyerUserId } = req.user;
      const { buyerWalletId, serviceId } = req.body;

      const purchase = await purchaseService.purchaseService(
        buyerUserId,
        serviceId,
        buyerWalletId,
      );

      return res.status(201).json({
        success: true,
        data: purchase,
      });
    } catch (error) {
      console.error("ServicePurchaseController.purchase error:", error);

      if (CLIENT_ERRORS.has(error.name)) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        error: "Server error.",
      });
    }
  }

  /**
   * Buyer: GET /services/my/purchases
   * Returns all services this user has bought.
   */
  async myPurchases(req, res) {
    try {
      const { id: userId } = req.user;
      const purchases = await purchaseService.getUserPurchases(userId);
      return res.status(200).json({ success: true, data: purchases });
    } catch (error) {
      console.error("ServicePurchaseController.myPurchases error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Server error. Please try again later.",
        });
    }
  }

  /**
   * Owner/admin: GET /services/:id/buyers
   * Returns all users who purchased a specific service.
   */
  async serviceBuyers(req, res) {
    try {
      const serviceId = Number(req.params.id);
      const buyers = await purchaseService.getServiceBuyers(serviceId);
      return res.status(200).json({ success: true, data: buyers });
    } catch (error) {
      console.error("ServicePurchaseController.serviceBuyers error:", error);
      return res
        .status(500)
        .json({
          success: false,
          error: "Server error. Please try again later.",
        });
    }
  }
}

module.exports = ServicePurchaseController;
