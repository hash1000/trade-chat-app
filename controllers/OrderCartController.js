const OrderCartService = require("../services/OrderCartService");

const cartService = new OrderCartService();

// Service payload is expensive to fully load (teams, team members, categories, add-ons,
// like status) — default everything to off so callers only pay for what they ask for.
function parseIncludeFlags(query) {
  return {
    includeTeams: query.includeTeams === "true",
    includeMembers: query.includeMembers === "true",
    includeCategories: query.includeCategories === "true",
    includeAddOns: query.includeAddOns === "true",
    isLiked: query.isLiked === "true",
  };
}

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

  // PATCH /orders/:orderId/address-delivery — lock address + delivery, DRAFT → PENDING
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

  // POST /orders/:orderId/confirm — atomic payment distribution, PENDING → CONFIRMED
  async confirmOrder(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const { walletType } = req.body;
      const data = await cartService.confirmOrder(userId, orderId, walletType);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // GET /orders/:orderId/payments — combined payment history (buyer wallet payments + admin records)
  async getOrderPayments(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const data = await cartService.getOrderPaymentHistory(userId, orderId);
      return res.status(200).json({ success: true, data, count: data.length });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // POST /orders/:orderId/top-up — buyer pays an additional amount against an already-confirmed order
  async topUpOrder(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const { amount, walletType, serviceOrderId } = req.body;
      const data = await cartService.topUpOrder(userId, orderId, amount, walletType, serviceOrderId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // POST /orders/:orderId/admin-payment — admin records a payment against an order, no wallet movement
  async adminRecordPayment(req, res) {
    try {
      const adminUserId = req.user.id;
      const orderId = Number(req.params.orderId);
      const { amount, type, note, serviceOrderId } = req.body;
      const data = await cartService.adminRecordPayment(adminUserId, orderId, amount, type, note, serviceOrderId);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // POST /carts/:cartId/checkout — generate order + confirm payment in one shot
  async checkoutCart(req, res) {
    try {
      const userId = req.user.id;
      const cartId = Number(req.params.cartId);
      const { addressId, deliveryOption, walletType } = req.body;
      const data = await cartService.checkoutCart(userId, cartId, addressId, deliveryOption, walletType);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // GET /orders/service-owner-orders — service owner gets orders for their services
  async getOrdersForServiceOwner(req, res) {
    try {
      const ownerId = req.user.id;
      const serviceId = req.query.serviceId ? Number(req.query.serviceId) : null;

      const usePagination = req.query.pagination === "true";
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

      const { results, pagination } = await cartService.getOrdersForServiceOwner(
        ownerId,
        serviceId,
        parseIncludeFlags(req.query),
        { pagination: usePagination, page, limit }
      );

      return res.status(200).json({
        success: true,
        data: results,
        count: results.length,
        ...(pagination && { pagination }),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // GET /orders — list user orders with optional status filter
  async listOrders(req, res) {
    try {
      const userId = req.user.id;
      const statuses = req.query.status ? (Array.isArray(req.query.status) ? req.query.status : [req.query.status]) : null;

      const usePagination = req.query.pagination === "true";
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

      const { orders, pagination } = await cartService.listOrders(userId, statuses, {
        pagination: usePagination,
        page,
        limit,
        ...parseIncludeFlags(req.query),
      });

      return res.status(200).json({
        success: true,
        data: orders,
        count: orders.length,
        ...(pagination && { pagination }),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // GET /orders/:orderId — get order detail
  async getOrder(req, res) {
    try {
      const userId = req.user.id;
      const orderId = Number(req.params.orderId);
      const data = await cartService.getOrder(userId, orderId, parseIncludeFlags(req.query));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }

  // POST /order/service-order/:orderId/add-ons — admin/accountant adds one or more
  // additional charges (catalog add-ons) to a placed order in a single call.
  async addOrderAddOns(req, res) {
    try {
      const actorUserId = req.user.id;
      const orderId = Number(req.params.orderId);
      const { addOns, addOnIds } = req.body;
      const data = await cartService.addOrderAddOns(actorUserId, orderId, addOns || addOnIds);
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

module.exports = OrderCartController;
