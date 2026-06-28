const OrderCartService = require("../services/OrderCartService");

const cartService = new OrderCartService();

function handleError(res, error) {
  const status = error.statusCode || 500;
  if (status < 500) {
    return res.status(status).json({
      success: false,
      error: error.message,
      code: error.code || undefined,
      data: error.data || undefined,
    });
  }
  console.error("[OrderCartController]", error);
  return res.status(500).json({ success: false, error: "Server error.", code: error.code || undefined });
}

class OrderCartController {
  // POST /carts/:cartId/orders — generate DRAFT order from cart
  async generateOrderFromCart(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const order = await cartService.generateOrderFromCart(userId, cartId);
      return res.status(201).json({ success: true, data: order });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // PATCH /orders/:orderId/address-delivery — lock address + delivery, DRAFT → PENDING_PAYMENT
  async setAddressAndDelivery(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const { addressId, deliveryOption } = req.body;
      const data = await cartService.setAddressAndDelivery(userId, orderId, addressId, deliveryOption);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // POST /orders/:orderId/confirm — atomic payment distribution, PENDING_PAYMENT → CONFIRMED
  async confirmOrder(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const data = await cartService.confirmOrder(userId, orderId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // GET /orders — list user orders with optional status filter
  async listOrders(req, res) {
    try {
      const userId = req.user.id;
      const statuses = req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : null;
      const data = await cartService.listOrders(userId, statuses);
      return res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // GET /orders/:orderId — get order detail
  async getOrder(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const data = await cartService.getOrder(userId, orderId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = OrderCartController;
