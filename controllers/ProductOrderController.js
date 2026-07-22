const ProductOrderService = require("../services/ProductOrderService");
const orderService = new ProductOrderService();

function handle(res, error, fallback) {
  console.error(fallback, error);
  return res
    .status(error.statusCode || 500)
    .json({ success: false, error: error.message || "Server error. Please try again later.", code: error.code });
}

class ProductOrderController {
  async checkout(req, res) {
    try {
      const { id: userId } = req.user;
      const { addressId, deliveryType, note, walletId } = req.body;

      const order = await orderService.checkout(userId, { addressId, deliveryType, note, walletId });
      return res.status(201).json({ success: true, message: "Order placed", order });
    } catch (error) {
      return handle(res, error, "ProductOrderController.checkout error:");
    }
  }

  // Buyer's paginated list of parent orders
  async getMyOrders(req, res) {
    try {
      const { id: userId } = req.user;
      const { page, limit } = req.query;

      const result = await orderService.getMyOrders(userId, { page, limit });
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductOrderController.getMyOrders error:");
    }
  }

  async getMyOrderById(req, res) {
    try {
      const { id: userId } = req.user;
      const { orderId } = req.params;

      const order = await orderService.getParentOrder(userId, Number(orderId));
      return res.json({ success: true, order });
    } catch (error) {
      return handle(res, error, "ProductOrderController.getMyOrderById error:");
    }
  }

  // Shop owner's (or admin's) paginated list of that shop's shop-orders
  async getShopOrders(req, res) {
    try {
      const { id: userId } = req.user;
      const { shopId } = req.params;
      const { page, limit, status } = req.query;

      const result = await orderService.getShopOrders(userId, Number(shopId), { page, limit, status });
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductOrderController.getShopOrders error:");
    }
  }

  async getOwnerShopOrders(req, res) {
    try {
      const { id: userId } = req.user;
      const { page, limit, status } = req.query;

      const result = await orderService.getShopOrdersForOwner(userId, { page, limit, status });
      return res.json({ success: true, ...result });
    } catch (error) {
      return handle(res, error, "ProductOrderController.getOwnerShopOrders error:");
    }
  }

  async getShopOrderById(req, res) {
    try {
      const { id: userId } = req.user;
      const { shopOrderId } = req.params;

      const shopOrder = await orderService.getShopOrder(userId, Number(shopOrderId));
      return res.json({ success: true, shopOrder });
    } catch (error) {
      return handle(res, error, "ProductOrderController.getShopOrderById error:");
    }
  }

  async updateStatus(req, res) {
    try {
      const { id: userId } = req.user;
      const { shopOrderId } = req.params;
      const { status } = req.body;

      const shopOrder = await orderService.updateShopOrderStatus(userId, Number(shopOrderId), status);
      return res.json({ success: true, message: "Status updated", shopOrder });
    } catch (error) {
      return handle(res, error, "ProductOrderController.updateStatus error:");
    }
  }

  async addCharge(req, res) {
    try {
      const { id: userId } = req.user;
      const { shopOrderId } = req.params;
      const { name, description, amount, addOnId } = req.body;

      const charge = await orderService.addCharge(userId, Number(shopOrderId), { name, description, amount, addOnId });
      return res.status(201).json({ success: true, message: "Charge added", charge });
    } catch (error) {
      return handle(res, error, "ProductOrderController.addCharge error:");
    }
  }

  async payCharge(req, res) {
    try {
      const { id: userId } = req.user;
      const { chargeId } = req.params;
      const { walletId } = req.body;

      const shopOrder = await orderService.payCharge(userId, Number(chargeId), walletId);
      return res.json({ success: true, message: "Charge paid", shopOrder });
    } catch (error) {
      return handle(res, error, "ProductOrderController.payCharge error:");
    }
  }
}

module.exports = ProductOrderController;
