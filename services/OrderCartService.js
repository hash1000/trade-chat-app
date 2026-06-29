const sequelize = require("../config/database");
const { Order, ServiceOrder, ServiceOrderAddOn, Cart, CartItem, Service, Wallet, WalletTransaction, Address } = require("../models");
const Transaction = require("../models/transaction");
const ServiceService = require("./ServiceService");

function clientError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

class OrderCartService {
  constructor() {
    this.serviceService = new ServiceService();
  }

  /**
   * Load the complete service payload (same shape as
   * GET /service?includeTeams=true&includeMembers=true&includeAddOns=true...).
   * Cached per request via the passed Map so a repeated serviceId is fetched once.
   */
  async loadFullService(serviceId, viewerId, cache) {
    if (cache.has(serviceId)) return cache.get(serviceId);
    const full = await this.serviceService.getById(serviceId, {
      userId: viewerId,
      includeTeams: true,
      includeMembers: true,
      includeCategories: true,
      includeAddOns: true,
      isLiked: true,
    });
    cache.set(serviceId, full);
    return full;
  }
  // Generate a DRAFT order from a cart (DB-backed)
  async generateOrderFromCart(userId, cartId) {
    const cart = await Cart.findOne({ where: { id: cartId, userId } });
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");
    if (cart.status === "converted") throw clientError("Cart already converted to order.", 400, "CART_CONVERTED");
    if (cart.status !== "active") throw clientError("Cart is not active.", 400, "CART_CONVERTED");

    const items = await CartItem.findAll({ where: { cartId } });
    if (items.length === 0) throw clientError("Cart is empty.", 400, "EMPTY_CART");

    // Snapshot current service prices at order time
    const serviceIds = [...new Set(items.map((i) => i.serviceId))];
    const services = await Service.findAll({
      where: { id: serviceIds, deletedAt: null },
      attributes: ["id", "userId", "name", "price", "payoutWalletId"],
    });
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

    for (const item of items) {
      if (!serviceMap[item.serviceId]) {
        throw clientError(`Service ${item.serviceId} no longer exists.`, 400, "SERVICE_NOT_FOUND");
      }
    }

    let orderTotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const svc = serviceMap[item.serviceId];
      const lockedPrice = parseFloat(svc.price || 0);
      const subtotal = lockedPrice * item.quantity;
      const discountAmount = parseFloat(item.discountAmount) || 0;
      const finalAmount = subtotal - discountAmount;
      const addOns = Array.isArray(item.addOns) ? item.addOns : [];
      const addOnSubtotal = addOns.reduce((sum, a) => sum + parseFloat(a.price) * a.quantity, 0);
      const itemTotal = finalAmount + addOnSubtotal;

      orderTotal += itemTotal;
      orderItemsData.push({
        item,
        svc,
        lockedPrice,
        subtotal,
        discountAmount,
        finalAmount,
        addOns,
        addOnSubtotal,
        itemTotal,
      });
    }

    const tx = await sequelize.transaction();
    try {
      const order = await Order.create(
        {
          userId,
          cartId,
          addressId: null,
          deliveryOption: null,
          creatorId: userId,
          creatorRole: "user",
          name: `Cart Order — ${cart.name}`,
          status: "PENDING",
          price: orderTotal,
          orderNo: `CO-${Date.now()}-${userId}`,
          image: "",
        },
        { transaction: tx }
      );

      const createdServiceOrders = [];

      for (const od of orderItemsData) {
        const so = await ServiceOrder.create(
          {
            orderId: order.id,
            serviceId: od.item.serviceId,
            serviceOwnerId: od.svc.userId,
            quantity: od.item.quantity,
            servicePriceAtOrder: od.lockedPrice,
            subtotal: od.subtotal,
            discountCode: od.item.discountCode || null,
            discountPercent: parseFloat(od.item.discountPercent) || 0,
            discountAmount: od.discountAmount,
            finalAmount: od.finalAmount,
            status: "PENDING",
          },
          { transaction: tx }
        );

        const createdAddOns = [];
        for (const addOn of od.addOns) {
          const soAddOn = await ServiceOrderAddOn.create(
            {
              serviceOrderId: so.id,
              addOnId: addOn.addOnId,
              quantity: addOn.quantity,
              priceAtOrder: parseFloat(addOn.price),
              subtotal: parseFloat(addOn.price) * addOn.quantity,
            },
            { transaction: tx }
          );
          createdAddOns.push({
            addOnId: addOn.addOnId,
            title: addOn.title,
            quantity: addOn.quantity,
            priceAtOrder: parseFloat(addOn.price),
            subtotal: soAddOn.subtotal,
          });
        }

        createdServiceOrders.push({
          serviceOrderId: so.id,
          serviceId: od.item.serviceId,
          serviceOwnerId: od.svc.userId,
          serviceName: od.svc.name,
          quantity: od.item.quantity,
          servicePriceAtOrder: od.lockedPrice,
          subtotal: od.subtotal,
          discountCode: od.item.discountCode || null,
          discountAmount: od.discountAmount,
          finalAmount: od.finalAmount,
          addOns: createdAddOns,
          itemTotal: od.itemTotal,
        });
      }

      // Mark cart as converted
      await Cart.update({ status: "converted" }, { where: { id: cartId }, transaction: tx });

      await tx.commit();

      return {
        orderId: order.id,
        userId,
        cartId,
        status: "PENDING",
        addressId: null,
        deliveryOption: null,
        totalAmount: orderTotal,
        items: createdServiceOrders,
        createdAt: order.createdAt,
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  // PATCH: lock address + delivery option, advance status to PENDING
  async setAddressAndDelivery(userId, orderId, addressId, deliveryOption) {
    const validOptions = ["standard", "express", "overnight"];
    if (!addressId) throw clientError("addressId is required.", 400, "VALIDATION_ERROR");
    if (!deliveryOption || !validOptions.includes(deliveryOption)) {
      throw clientError("Invalid delivery option. Must be: standard, express, overnight.", 400, "VALIDATION_ERROR");
    }

    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");
    if (order.userId !== userId) throw clientError("Unauthorized.", 403, "UNAUTHORIZED");
    if (order.status !== "PENDING") throw clientError("Order not in PENDING status.", 409, "INVALID_STATE");

    const address = await Address.findByPk(addressId);
    if (!address || address.userId !== userId) throw clientError("Address not found.", 404, "NOT_FOUND");

    await order.update({ addressId, deliveryOption, status: "PENDING" });

    return {
      orderId: order.id,
      addressId,
      deliveryOption,
      status: "PENDING",
      totalAmount: parseFloat(order.price),
    };
  }

  // POST: confirm order — atomically distribute payment to each service owner
  async confirmOrder(userId, orderId, walletType) {
    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");
    if (order.userId !== userId) throw clientError("Unauthorized.", 403, "UNAUTHORIZED");
    if (order.status === "CONFIRMED") throw clientError("Order already confirmed.", 409, "INVALID_STATE");
    if (order.status !== "PENDING") throw clientError("Order is not ready for payment.", 409, "INVALID_STATE");
    // if (!order.addressId || !order.deliveryOption) {
    //   throw clientError("Order missing address or delivery option.", 400, "INCOMPLETE_ORDER");
    // }

    // Buyer chooses which wallet to pay from (defaults to PERSONAL)
    const VALID_WALLET_TYPES = ["PERSONAL", "COMPANY"];
    const buyerWalletType = walletType || "PERSONAL";
    if (!VALID_WALLET_TYPES.includes(buyerWalletType)) {
      throw clientError("Invalid walletType. Must be PERSONAL or COMPANY.", 400, "VALIDATION_ERROR");
    }

    const serviceOrders = await ServiceOrder.findAll({ where: { orderId } });
    if (serviceOrders.length === 0) throw clientError("Order has no items.", 400, "EMPTY_ORDER");

    const totalAmount = parseFloat(order.price);

    // Find buyer's wallet of the chosen type
    const buyerWallet = await Wallet.findOne({ where: { userId, walletType: buyerWalletType } });
    if (!buyerWallet) throw clientError(`Buyer ${buyerWalletType} wallet not found.`, 402, "NO_WALLET");

    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < totalAmount) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: totalAmount, available: buyerBalance };
      throw err;
    }

    // Resolve each service's payout wallet (keyed by serviceId, since the chosen
    // wallet is configured per service):
    //   - service.payoutWalletId if the provider has chosen one
    //   - else fallback to the owner's wallet, COMPANY-first
    const serviceWalletMap = {};
    for (const so of serviceOrders) {
      if (serviceWalletMap[so.serviceId]) continue;

      const svc = await Service.findByPk(so.serviceId, { attributes: ["id", "userId", "payoutWalletId"] });

      let ownerWallet = null;
      if (svc && svc.payoutWalletId) {
        ownerWallet = await Wallet.findByPk(svc.payoutWalletId);
      }
      if (!ownerWallet) {
        ownerWallet = await Wallet.findOne({
          where: { userId: so.serviceOwnerId },
          order: [["walletType", "ASC"]], // COMPANY first if exists
        });
      }
      if (!ownerWallet) throw clientError(`Payout wallet not found for service owner ${so.serviceOwnerId}.`, 500, "PAYMENT_ERROR");
      serviceWalletMap[so.serviceId] = ownerWallet;
    }

    const tx = await sequelize.transaction();
    try {
      // Deduct total from buyer wallet
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${totalAmount}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );

      const distributions = [];

      for (const so of serviceOrders) {
        const addOns = await ServiceOrderAddOn.findAll({ where: { serviceOrderId: so.id } });
        const addOnSubtotal = addOns.reduce((sum, a) => sum + parseFloat(a.subtotal), 0);
        const amount = parseFloat(so.finalAmount) + addOnSubtotal;

        const ownerWallet = serviceWalletMap[so.serviceId];

        // Credit owner wallet
        await Wallet.update(
          { availableBalance: sequelize.literal(`availableBalance + ${amount}`) },
          { where: { id: ownerWallet.id }, transaction: tx }
        );

        // Record wallet transaction for buyer (debit)
        const txnRecord = await WalletTransaction.create(
          {
            walletId: buyerWallet.id,
            userId,
            receiverId: so.serviceOwnerId,
            type: "TRANSFER",
            amount,
            currency: buyerWallet.currency,
            description: `Payment for service order #${so.id}`,
            referenceType: "SERVICE_ORDER",
            referenceId: so.id,
            performedBy: userId,
          },
          { transaction: tx }
        );

        // Mark service order as PURCHASED
        await ServiceOrder.update(
          { status: "PURCHASED" },
          { where: { id: so.id }, transaction: tx }
        );

        distributions.push({
          serviceId: so.serviceId,
          serviceOwnerId: so.serviceOwnerId,
          amount,
          walletId: ownerWallet.id,
          transactionId: txnRecord.id,
        });
      }

      // Confirm the order
      await Order.update({ status: "CONFIRMED" }, { where: { id: orderId }, transaction: tx });

      await tx.commit();

      return {
        orderId,
        status: "CONFIRMED",
        totalAmount,
        paymentDetails: {
          buyerWallet: { id: buyerWallet.id, walletType: buyerWalletType, deducted: totalAmount },
          distributions,
        },
        confirmedAt: new Date().toISOString(),
      };
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Payment distribution failed. No funds deducted. Please retry.", 500, "PAYMENT_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // POST: checkout cart in one shot — generate order + set address/delivery + confirm payment
  async checkoutCart(userId, cartId, addressId, deliveryOption) {
    const validOptions = ["standard", "express", "overnight"];
    if (deliveryOption && !validOptions.includes(deliveryOption)) {
      throw clientError("Invalid delivery option. Must be: standard, express, overnight.", 400, "VALIDATION_ERROR");
    }

    const cart = await Cart.findOne({ where: { id: cartId, userId } });
    if (!cart) throw clientError("Cart not found.", 404, "NOT_FOUND");
    if (cart.status === "converted") throw clientError("Cart already converted to order.", 400, "CART_CONVERTED");
    if (cart.status !== "active") throw clientError("Cart is not active.", 400, "CART_CONVERTED");

    const items = await CartItem.findAll({ where: { cartId } });
    if (items.length === 0) throw clientError("Cart is empty.", 400, "EMPTY_CART");

    if (addressId) {
      const address = await Address.findByPk(addressId);
      if (!address || address.userId !== userId) throw clientError("Address not found.", 404, "NOT_FOUND");
    }

    const serviceIds = [...new Set(items.map((i) => i.serviceId))];
    const services = await Service.findAll({
      where: { id: serviceIds, deletedAt: null },
      attributes: ["id", "userId", "name", "price", "payoutWalletId"],
    });
    const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]));

    for (const item of items) {
      if (!serviceMap[item.serviceId]) {
        throw clientError(`Service ${item.serviceId} no longer exists.`, 400, "SERVICE_NOT_FOUND");
      }
    }

    let orderTotal = 0;
    const orderItemsData = [];

    for (const item of items) {
      const svc = serviceMap[item.serviceId];
      const lockedPrice = parseFloat(svc.price || 0);
      const subtotal = lockedPrice * item.quantity;
      const discountAmount = parseFloat(item.discountAmount) || 0;
      const finalAmount = subtotal - discountAmount;
      const addOns = Array.isArray(item.addOns) ? item.addOns : [];
      const addOnSubtotal = addOns.reduce((sum, a) => sum + parseFloat(a.price) * a.quantity, 0);
      const itemTotal = finalAmount + addOnSubtotal;
      orderTotal += itemTotal;
      orderItemsData.push({ item, svc, lockedPrice, subtotal, discountAmount, finalAmount, addOns, addOnSubtotal, itemTotal });
    }

    const buyerWallet = await Wallet.findOne({ where: { userId, walletType: "PERSONAL" } });
    if (!buyerWallet) throw clientError("Buyer wallet not found.", 402, "NO_WALLET");
    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < orderTotal) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: orderTotal, available: buyerBalance };
      throw err;
    }

    const ownerWalletMap = {};
    for (const od of orderItemsData) {
      if (!ownerWalletMap[od.svc.userId]) {
        const ownerWallet = await Wallet.findOne({
          where: { userId: od.svc.userId },
          order: [["walletType", "ASC"]],
        });
        if (!ownerWallet) throw clientError(`Payout wallet not found for service owner ${od.svc.userId}.`, 500, "PAYMENT_ERROR");
        ownerWalletMap[od.svc.userId] = ownerWallet;
      }
    }

    const tx = await sequelize.transaction();
    try {
      const order = await Order.create(
        {
          userId,
          cartId,
          addressId,
          deliveryOption,
          creatorId: userId,
          creatorRole: "user",
          name: `Cart Order — ${cart.name}`,
          status: "CONFIRMED",
          price: orderTotal,
          orderNo: `CO-${Date.now()}-${userId}`,
          image: "",
        },
        { transaction: tx }
      );

      const distributions = [];

      for (const od of orderItemsData) {
        const so = await ServiceOrder.create(
          {
            orderId: order.id,
            serviceId: od.item.serviceId,
            serviceOwnerId: od.svc.userId,
            quantity: od.item.quantity,
            servicePriceAtOrder: od.lockedPrice,
            subtotal: od.subtotal,
            discountCode: od.item.discountCode || null,
            discountPercent: parseFloat(od.item.discountPercent) || 0,
            discountAmount: od.discountAmount,
            finalAmount: od.finalAmount,
            status: "PURCHASED",
          },
          { transaction: tx }
        );

        const addOnSubtotalFinal = od.addOns.reduce((sum, a) => sum + parseFloat(a.price) * a.quantity, 0);

        for (const addOn of od.addOns) {
          await ServiceOrderAddOn.create(
            {
              serviceOrderId: so.id,
              addOnId: addOn.addOnId,
              quantity: addOn.quantity,
              priceAtOrder: parseFloat(addOn.price),
              subtotal: parseFloat(addOn.price) * addOn.quantity,
            },
            { transaction: tx }
          );
        }

        const amount = od.finalAmount + addOnSubtotalFinal;
        const ownerWallet = ownerWalletMap[od.svc.userId];

        await Wallet.update(
          { availableBalance: sequelize.literal(`availableBalance + ${amount}`) },
          { where: { id: ownerWallet.id }, transaction: tx }
        );

        const txnRecord = await WalletTransaction.create(
          {
            walletId: buyerWallet.id,
            userId,
            receiverId: od.svc.userId,
            type: "TRANSFER",
            amount,
            currency: buyerWallet.currency,
            description: `Payment for service order #${so.id}`,
            referenceType: "SERVICE_ORDER",
            referenceId: so.id,
            performedBy: userId,
          },
          { transaction: tx }
        );

        distributions.push({
          serviceId: od.item.serviceId,
          serviceOwnerId: od.svc.userId,
          amount,
          walletId: ownerWallet.id,
          transactionId: txnRecord.id,
        });
      }

      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${orderTotal}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );

      await Cart.update({ status: "converted" }, { where: { id: cartId }, transaction: tx });

      const txnOrderId = `cart-order-${order.id}-${Date.now()}`;
      await Transaction.create(
        {
          orderId: txnOrderId,
          userId,
          amount: orderTotal,
          paidAmount: orderTotal,
          paidCurrency: buyerWallet.currency,
          rate: 1,
          currency: buyerWallet.currency,
          type: "cart_checkout",
          status: "completed",
          paymentMethod: "wallet",
          metadata: { cartId, serviceOrderIds: distributions.map((d) => d.serviceOrderId) },
        },
        { transaction: tx }
      );

      await tx.commit();

      return {
        orderId: order.id,
        userId,
        cartId,
        status: "CONFIRMED",
        addressId,
        deliveryOption,
        totalAmount: orderTotal,
        paymentDetails: {
          buyerWallet: { id: buyerWallet.id, deducted: orderTotal },
          distributions,
        },
        confirmedAt: new Date().toISOString(),
      };
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Checkout failed. No funds deducted. Please retry.", 500, "PAYMENT_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // List orders for a user
  async listOrders(userId, statuses) {
    const where = { userId };
    if (statuses && statuses.length > 0) where.status = statuses;
    console.log("listOrders where:", where);
    const orders = await Order.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    const serviceCache = new Map();
    const result = [];
    for (const o of orders) {
      const serviceOrders = await ServiceOrder.findAll({ where: { orderId: o.id } });
      const services = await Promise.all(
        serviceOrders.map(async (so) => {
          const service = await this.loadFullService(so.serviceId, userId, serviceCache);
          return {
            serviceOrderId: so.id,
            serviceId: so.serviceId,
            quantity: so.quantity,
            finalAmount: parseFloat(so.finalAmount),
            status: so.status,
            service,
          };
        })
      );
      result.push({
        orderId: o.id,
        cartId: o.cartId,
        status: o.status,
        totalAmount: parseFloat(o.price),
        createdAt: o.createdAt,
        services,
      });
    }
    return result;
  }

  // Get single order with items
  async getOrder(userId, orderId) {
    const order = await Order.findByPk(orderId);
    if (!order || order.userId !== userId) throw clientError("Order not found.", 404, "NOT_FOUND");

    const serviceOrders = await ServiceOrder.findAll({ where: { orderId } });
    const serviceCache = new Map();
    const items = [];
    for (const so of serviceOrders) {
      const [addOns, service] = await Promise.all([
        ServiceOrderAddOn.findAll({ where: { serviceOrderId: so.id } }),
        this.loadFullService(so.serviceId, userId, serviceCache),
      ]);
      const addOnSubtotal = addOns.reduce((s, a) => s + parseFloat(a.subtotal), 0);
      items.push({
        serviceOrderId: so.id,
        serviceId: so.serviceId,
        serviceOwnerId: so.serviceOwnerId,
        quantity: so.quantity,
        servicePriceAtOrder: parseFloat(so.servicePriceAtOrder),
        subtotal: parseFloat(so.subtotal),
        discountCode: so.discountCode,
        discountAmount: parseFloat(so.discountAmount),
        finalAmount: parseFloat(so.finalAmount),
        addOns: addOns.map((a) => ({
          addOnId: a.addOnId,
          quantity: a.quantity,
          priceAtOrder: parseFloat(a.priceAtOrder),
          subtotal: parseFloat(a.subtotal),
        })),
        itemTotal: parseFloat(so.finalAmount) + addOnSubtotal,
        status: so.status,
        service,
      });
    }

    return {
      orderId: order.id,
      userId: order.userId,
      cartId: order.cartId,
      status: order.status,
      addressId: order.addressId,
      deliveryOption: order.deliveryOption,
      totalAmount: parseFloat(order.price),
      items,
      createdAt: order.createdAt,
    };
  }
  // GET: service owner — list all orders containing their service(s)
  async getOrdersForServiceOwner(ownerId, serviceId) {
    const where = { serviceOwnerId: ownerId };
    if (serviceId) where.serviceId = serviceId;

    const serviceOrders = await ServiceOrder.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });

    const serviceCache = new Map();
    const results = [];
    for (const so of serviceOrders) {
      const order = await Order.findByPk(so.orderId);
      const addOns = await ServiceOrderAddOn.findAll({ where: { serviceOrderId: so.id } });
      const service = await this.loadFullService(so.serviceId, ownerId, serviceCache);
      const addOnSubtotal = addOns.reduce((s, a) => s + parseFloat(a.subtotal), 0);

      results.push({
        serviceOrderId: so.id,
        orderId: so.orderId,
        orderNo: order?.orderNo,
        buyerId: order?.userId,
        serviceId: so.serviceId,
        quantity: so.quantity,
        servicePriceAtOrder: parseFloat(so.servicePriceAtOrder),
        subtotal: parseFloat(so.subtotal),
        discountCode: so.discountCode,
        discountAmount: parseFloat(so.discountAmount),
        finalAmount: parseFloat(so.finalAmount),
        addOns: addOns.map((a) => ({
          addOnId: a.addOnId,
          quantity: a.quantity,
          priceAtOrder: parseFloat(a.priceAtOrder),
          subtotal: parseFloat(a.subtotal),
        })),
        service,
        itemTotal: parseFloat(so.finalAmount) + addOnSubtotal,
        status: so.status,
        addressId: order?.addressId,
        deliveryOption: order?.deliveryOption,
        createdAt: so.createdAt,
      });
    }

    return results;
  }
}

module.exports = OrderCartService;
