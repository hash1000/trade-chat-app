const sequelize = require("../config/database");
const { Order, ServiceOrder, ServiceOrderAddOn, ServiceAddOn, Cart, CartItem, Service, Wallet, WalletTransaction, Address, OrderPayment, User, Role } = require("../models");
const Transaction = require("../models/transaction");
const ServiceService = require("./ServiceService");
const UserService = require("./UserService");
const NotificationService = require("./NotificationService");
const notificationService = new NotificationService();

const fmtAmount = (v) => Number(v).toString();

// One notification per service owner about their items in an order.
// items: [{ serviceOwnerId, amount, serviceName? }]. Never throws.
async function notifyServiceOwners(items, { buyerId, orderId, type, title, messageFor }) {
  try {
    const byOwner = new Map();
    for (const item of items) {
      if (!item.serviceOwnerId || item.serviceOwnerId === buyerId) continue;
      if (!byOwner.has(item.serviceOwnerId)) byOwner.set(item.serviceOwnerId, { amount: 0, names: [] });
      const entry = byOwner.get(item.serviceOwnerId);
      entry.amount += Number(item.amount) || 0;
      if (item.serviceName) entry.names.push(item.serviceName);
    }
    if (!byOwner.size) return;

    const buyer = await User.findByPk(buyerId, { attributes: ["id", "username", "email"] });
    const buyerName = (buyer && (buyer.username || buyer.email)) || `User #${buyerId}`;

    for (const [ownerId, entry] of byOwner.entries()) {
      await notificationService.notifyUser({
        userId: ownerId,
        actorId: buyerId,
        type,
        title,
        message: messageFor(buyerName, entry),
        entityType: "ORDER",
        entityId: orderId,
        data: {
          amount: fmtAmount(entry.amount),
          buyerName,
          services: entry.names,
        },
      });
    }
  } catch (error) {
    console.error("notifyServiceOwners error:", error.message);
  }
}

const PAYMENT_HISTORY_ROLES = ["admin", "accountant"];

function clientError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

class OrderCartService {
  constructor() {
    this.serviceService = new ServiceService();
    this.userService = new UserService();
  }

  /**
   * Load the service payload (same shape as GET /service?includeTeams=...&includeMembers=...).
   * All the includeX flags default to false — pass only what you actually need, since each one
   * adds a join/query and the fully-loaded payload is what made this endpoint slow.
   * Cached per request (keyed by serviceId + the flags used) via the passed Map.
   */
  async loadFullService(serviceId, viewerId, cache, includeOptions = {}) {
    const {
      includeTeams = false,
      includeMembers = false,
      includeCategories = false,
      includeAddOns = false,
      isLiked = false,
    } = includeOptions;

    const cacheKey = `${serviceId}|${includeTeams}|${includeMembers}|${includeCategories}|${includeAddOns}|${isLiked}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const full = await this.serviceService.getById(serviceId, {
      userId: viewerId,
      includeTeams,
      includeMembers,
      includeCategories,
      includeAddOns,
      isLiked,
    });
    cache.set(cacheKey, full);
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

      await notifyServiceOwners(
        createdServiceOrders.map((so) => ({
          serviceOwnerId: so.serviceOwnerId,
          amount: so.itemTotal,
          serviceName: so.serviceName,
        })),
        {
          buyerId: userId,
          orderId: order.id,
          type: "SERVICE_ORDER_CREATED",
          title: "New Order Received",
          messageFor: (buyerName, entry) =>
            `${buyerName} placed an order for your service${entry.names.length > 1 ? "s" : ""} ${entry.names.join(", ")} — total ${fmtAmount(entry.amount)} (Order #${order.id}).`,
        },
      );

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

  // Resolve a service order's payout wallet:
  //   - service.payoutWalletId if the provider has chosen one
  //   - else fallback to the owner's wallet, COMPANY-first
  async resolveOwnerWallet(so) {
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
    return ownerWallet;
  }

  // Sum of a service order's finalAmount + its add-ons
  async itemTotalForServiceOrder(so) {
    const addOns = await ServiceOrderAddOn.findAll({ where: { serviceOrderId: so.id } });
    const addOnSubtotal = addOns.reduce((sum, a) => sum + parseFloat(a.subtotal), 0);
    return parseFloat(so.finalAmount) + addOnSubtotal;
  }

  // Merge buyer wallet payments (confirm + top-up) and admin-recorded payments
  // into one chronological history for an order. No auth check here — callers
  // that expose this externally must authorize first.
  async _fetchPaymentHistoryRows(orderId) {
    const serviceOrders = await ServiceOrder.findAll({ where: { orderId }, attributes: ["id"] });
    const serviceOrderIds = serviceOrders.map((so) => so.id);

    const [walletTxns, adminRecords] = await Promise.all([
      serviceOrderIds.length
        ? WalletTransaction.findAll({
            where: { referenceType: "SERVICE_ORDER", referenceId: serviceOrderIds },
            include: [{ model: User, as: "performer", attributes: ["id", "username", "email"] }],
            order: [["createdAt", "DESC"]],
          })
        : [],
      OrderPayment.findAll({
        where: { orderId },
        include: [{ model: User, as: "recordedBy", attributes: ["id", "username", "email"] }],
        order: [["createdAt", "DESC"]],
      }),
    ]);

    const buyerEntries = walletTxns.map((wt) => ({
      source: "BUYER_WALLET",
      type: wt.type,
      amount: parseFloat(wt.amount),
      currency: wt.currency,
      serviceOrderId: wt.referenceId,
      description: wt.description,
      performedBy: wt.performer
        ? { id: wt.performer.id, username: wt.performer.username, email: wt.performer.email }
        : null,
      createdAt: wt.createdAt,
    }));

    const adminEntries = adminRecords.map((op) => ({
      source: "ADMIN_RECORD",
      type: op.type,
      amount: parseFloat(op.amount),
      currency: null,
      serviceOrderId: op.serviceOrderId,
      description: op.note,
      performedBy: op.recordedBy
        ? { id: op.recordedBy.id, username: op.recordedBy.username, email: op.recordedBy.email }
        : null,
      createdAt: op.createdAt,
    }));

    return [...buyerEntries, ...adminEntries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // GET /orders/:orderId/payments — combined payment history, viewable by the
  // order's buyer or by an admin/accountant
  async getOrderPaymentHistory(requestingUserId, orderId) {
    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");

    if (order.userId !== requestingUserId) {
      const requester = await this.userService.getUserById(requestingUserId);
      const requesterRoles = (requester && requester.roles ? requester.roles : []).map((r) => r.name);
      const isPrivileged = PAYMENT_HISTORY_ROLES.some((r) => requesterRoles.includes(r));
      if (!isPrivileged) throw clientError("Unauthorized.", 403, "UNAUTHORIZED");
    }

    return this._fetchPaymentHistoryRows(orderId);
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
    // wallet is configured per service)
    const serviceWalletMap = {};
    for (const so of serviceOrders) {
      if (serviceWalletMap[so.serviceId]) continue;
      serviceWalletMap[so.serviceId] = await this.resolveOwnerWallet(so);
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
            orderId,
            performedBy: userId,
          },
          { transaction: tx }
        );

        // Mark service order as PURCHASED and track amount paid against it
        await ServiceOrder.update(
          { status: "PURCHASED", paidAmount: sequelize.literal(`paidAmount + ${amount}`) },
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

      // Confirm the order and track amount paid against it
      await Order.update(
        { status: "CONFIRMED", paidAmount: sequelize.literal(`paidAmount + ${totalAmount}`) },
        { where: { id: orderId }, transaction: tx }
      );

      await tx.commit();

      await notifyServiceOwners(distributions, {
        buyerId: userId,
        orderId,
        type: "SERVICE_ORDER_PURCHASED",
        title: "Payment Received",
        messageFor: (buyerName, entry) =>
          `${buyerName} paid ${fmtAmount(entry.amount)} for your service order(s) in Order #${orderId}. The amount has been credited to your wallet.`,
      });

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

  // POST: buyer pays an additional amount against an already-confirmed order.
  // Not capped by the order's original totalAmount — buyer can pay any amount, any
  // number of times. Deducts from the buyer's chosen wallet and credits the
  // service owner(s), same as confirmOrder. If serviceOrderId is given, the full
  // amount goes to that single item's owner; otherwise it's split proportionally
  // across every item in the order by its original share of the order total.
  async topUpOrder(userId, orderId, amount, walletType, serviceOrderId, payFullBalance = false) {
    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");
    if (order.userId !== userId) throw clientError("Unauthorized.", 403, "UNAUTHORIZED");
    if (order.status !== "CONFIRMED") {
      throw clientError("Order must be confirmed before making an additional payment.", 409, "INVALID_STATE");
    }

    const serviceOrders = await ServiceOrder.findAll({ where: { orderId } });
    if (serviceOrders.length === 0) throw clientError("Order has no items.", 400, "EMPTY_ORDER");

    // Each item's outstanding balance = (finalAmount + add-ons) − paidAmount. Computed
    // from the items, never from the order row (which can drift and doesn't reflect
    // post-order add-on charges). This is the same basis the GET uses for balanceDue.
    const itemTotals = await Promise.all(serviceOrders.map((so) => this.itemTotalForServiceOrder(so)));
    const itemDues = serviceOrders.map((so, idx) =>
      Math.max(0, itemTotals[idx] - parseFloat(so.paidAmount))
    );
    const orderBalanceDue = itemDues.reduce((s, v) => s + v, 0);

    // When payFullBalance is set, charge exactly the order's outstanding balance
    // instead of a caller-supplied amount.
    let parsedAmount;
    if (payFullBalance) {
      if (orderBalanceDue <= 0) {
        throw clientError("Order has no outstanding balance to pay.", 409, "NOTHING_DUE");
      }
      parsedAmount = orderBalanceDue;
    } else {
      parsedAmount = parseFloat(amount);
      if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        throw clientError("amount must be a number greater than 0.", 400, "VALIDATION_ERROR");
      }
    }

    // Decide which item(s) receive the payment.
    let targets;
    if (serviceOrderId) {
      const target = serviceOrders.find((so) => so.id === Number(serviceOrderId));
      if (!target) throw clientError("Service order item not found in this order.", 404, "NOT_FOUND");
      targets = [{ so: target, share: parsedAmount }];
    } else if (orderBalanceDue > 0) {
      // Route the payment to the items that actually owe money, in proportion to how
      // much each still owes — so paying 200 lands on the item with a 200 balance, not
      // spread across already-settled items.
      targets = serviceOrders
        .map((so, idx) => ({ so, due: itemDues[idx] }))
        .filter((t) => t.due > 0)
        .map((t) => ({ so: t.so, share: parsedAmount * (t.due / orderBalanceDue) }));
    } else {
      // Nothing outstanding (an explicit over-payment) — split proportionally by item total.
      const sumItemTotals = itemTotals.reduce((s, v) => s + v, 0);
      targets = serviceOrders.map((so, idx) => ({
        so,
        share: sumItemTotals > 0
          ? parsedAmount * (itemTotals[idx] / sumItemTotals)
          : parsedAmount / serviceOrders.length, // equal split fallback
      }));
    }

    // Buyer chooses which wallet to pay from (defaults to PERSONAL)
    const VALID_WALLET_TYPES = ["PERSONAL", "COMPANY"];
    const buyerWalletType = walletType || "PERSONAL";
    if (!VALID_WALLET_TYPES.includes(buyerWalletType)) {
      throw clientError("Invalid walletType. Must be PERSONAL or COMPANY.", 400, "VALIDATION_ERROR");
    }

    const buyerWallet = await Wallet.findOne({ where: { userId, walletType: buyerWalletType } });
    if (!buyerWallet) throw clientError(`Buyer ${buyerWalletType} wallet not found.`, 402, "NO_WALLET");

    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < parsedAmount) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: parsedAmount, available: buyerBalance };
      throw err;
    }

    const ownerWallets = await Promise.all(targets.map((t) => this.resolveOwnerWallet(t.so)));

    const tx = await sequelize.transaction();
    try {
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${parsedAmount}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );

      const distributions = [];

      for (let i = 0; i < targets.length; i++) {
        const { so, share } = targets[i];
        const ownerWallet = ownerWallets[i];

        await Wallet.update(
          { availableBalance: sequelize.literal(`availableBalance + ${share}`) },
          { where: { id: ownerWallet.id }, transaction: tx }
        );

        const txnRecord = await WalletTransaction.create(
          {
            walletId: buyerWallet.id,
            userId,
            receiverId: so.serviceOwnerId,
            type: "TRANSFER",
            amount: share,
            currency: buyerWallet.currency,
            description: `Additional payment for service order #${so.id}`,
            referenceType: "SERVICE_ORDER",
            referenceId: so.id,
            orderId,
            performedBy: userId,
          },
          { transaction: tx }
        );

        await ServiceOrder.update(
          { paidAmount: sequelize.literal(`paidAmount + ${share}`) },
          { where: { id: so.id }, transaction: tx }
        );

        distributions.push({
          serviceOrderId: so.id,
          serviceId: so.serviceId,
          serviceOwnerId: so.serviceOwnerId,
          amount: share,
          walletId: ownerWallet.id,
          transactionId: txnRecord.id,
        });
      }

      await Order.update(
        { paidAmount: sequelize.literal(`paidAmount + ${parsedAmount}`) },
        { where: { id: orderId }, transaction: tx }
      );

      await tx.commit();

      await notifyServiceOwners(distributions, {
        buyerId: userId,
        orderId,
        type: "SERVICE_ORDER_TOPUP",
        title: "Additional Payment Received",
        messageFor: (buyerName, entry) =>
          `${buyerName} made an additional payment of ${fmtAmount(entry.amount)} for your service order(s) in Order #${orderId}. The amount has been credited to your wallet.`,
      });

      // Balance remaining after this payment (computed from items' outstanding dues,
      // which we just paid down by parsedAmount).
      const remainingBalance = Math.max(0, orderBalanceDue - parsedAmount);

      return {
        orderId,
        amountPaid: parsedAmount,
        remainingBalance,
        fullyPaid: remainingBalance <= 0,
        paymentDetails: {
          buyerWallet: { id: buyerWallet.id, walletType: buyerWalletType, deducted: parsedAmount },
          distributions,
        },
        paidAt: new Date().toISOString(),
      };
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Additional payment failed. No funds deducted. Please retry.", 500, "PAYMENT_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // POST: admin records a payment against an order that was received outside the
  // platform (cash, bank transfer, etc.). Credits the owner's wallet for real — no
  // buyer wallet is debited, since the buyer didn't pay through the platform.
  async adminRecordPayment(adminUserId, orderId, amount, type, note, serviceOrderId) {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw clientError("amount must be a number greater than 0.", 400, "VALIDATION_ERROR");
    }

    const VALID_TYPES = ["order_payment", "order_top_up"];
    const recordType = type || "order_payment";
    if (!VALID_TYPES.includes(recordType)) {
      throw clientError("Invalid type. Must be order_payment or order_top_up.", 400, "VALIDATION_ERROR");
    }

    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");

    let serviceOrder = null;
    if (serviceOrderId) {
      serviceOrder = await ServiceOrder.findOne({ where: { id: serviceOrderId, orderId } });
      if (!serviceOrder) throw clientError("Service order item not found in this order.", 404, "NOT_FOUND");
    }

    // No serviceOrderId → this payment applies to the whole order, so it must be
    // spread across every item's ServiceOrder.paidAmount (not just Order.paidAmount),
    // otherwise the read paths — which sum paidAmount from ServiceOrder rows, see
    // getOrder/listOrders — never reflect it. Same targeting rule as topUpOrder:
    // proportional to each item's outstanding due, falling back to proportional-by-total
    // (or an equal split) when nothing is due.
    let targets;
    if (serviceOrder) {
      targets = [{ so: serviceOrder, share: parsedAmount }];
    } else {
      const serviceOrders = await ServiceOrder.findAll({ where: { orderId } });
      if (serviceOrders.length === 0) throw clientError("Order has no items.", 400, "EMPTY_ORDER");

      const itemTotals = await Promise.all(serviceOrders.map((so) => this.itemTotalForServiceOrder(so)));
      const itemDues = serviceOrders.map((so, idx) => Math.max(0, itemTotals[idx] - parseFloat(so.paidAmount)));
      const totalDue = itemDues.reduce((s, v) => s + v, 0);

      if (totalDue > 0) {
        targets = serviceOrders
          .map((so, idx) => ({ so, due: itemDues[idx] }))
          .filter((t) => t.due > 0)
          .map((t) => ({ so: t.so, share: parsedAmount * (t.due / totalDue) }));
      } else {
        const sumItemTotals = itemTotals.reduce((s, v) => s + v, 0);
        targets = serviceOrders.map((so, idx) => ({
          so,
          share: sumItemTotals > 0
            ? parsedAmount * (itemTotals[idx] / sumItemTotals)
            : parsedAmount / serviceOrders.length,
        }));
      }
    }

    // Admin-recorded payments still credit the owner's wallet for real — the money was
    // received outside the platform (cash, bank transfer, etc.), so this is what actually
    // gets it into the owner's account. No buyer wallet is debited since the buyer didn't
    // pay through the platform.
    const ownerWallets = await Promise.all(targets.map((t) => this.resolveOwnerWallet(t.so)));

    const tx = await sequelize.transaction();
    try {
      const record = await OrderPayment.create(
        {
          orderId,
          serviceOrderId: serviceOrderId || null,
          type: recordType,
          amount: parsedAmount,
          note: note || null,
          createdBy: adminUserId,
        },
        { transaction: tx }
      );

      // All recorded payments (original or top-up) pay down the order balance, so
      // both count toward paidAmount. The ledger `type` still distinguishes them for
      // reporting. balanceDue = total − paidAmount, so top-ups must land here too.
      const targetField = "paidAmount";

      await Order.update(
        { [targetField]: sequelize.literal(`${targetField} + ${parsedAmount}`) },
        { where: { id: orderId }, transaction: tx }
      );

      for (let i = 0; i < targets.length; i++) {
        const { so, share } = targets[i];
        const ownerWallet = ownerWallets[i];

        await ServiceOrder.update(
          { [targetField]: sequelize.literal(`${targetField} + ${share}`) },
          { where: { id: so.id }, transaction: tx }
        );

        // Credit the owner's wallet with their share of the admin-recorded payment.
        await Wallet.update(
          { availableBalance: sequelize.literal(`availableBalance + ${share}`) },
          { where: { id: ownerWallet.id }, transaction: tx }
        );

        // type: DEPOSIT (not TRANSFER) — there's no counterpart debit anywhere (no
        // buyer wallet involved), so this must bucket as a credit in wallet summaries
        // (WalletService.js treats DEPOSIT/UNLOCK as credit, everything else as debit).
        await WalletTransaction.create(
          {
            walletId: ownerWallet.id,
            userId: so.serviceOwnerId,
            receiverId: so.serviceOwnerId,
            type: "DEPOSIT",
            amount: share,
            currency: ownerWallet.currency,
            description: `Admin-recorded ${recordType === "order_top_up" ? "top-up" : "payment"} for service order #${so.id}`,
            referenceType: "SERVICE_ORDER",
            referenceId: so.id,
            orderId,
            performedBy: adminUserId,
          },
          { transaction: tx }
        );
      }

      await tx.commit();

      await notificationService.notifyUser({
        userId: order.userId,
        actorId: adminUserId,
        type: "ORDER_PAYMENT_RECORDED",
        title: "Payment Recorded",
        message: `Admin recorded a ${recordType === "order_top_up" ? "top-up" : "payment"} of ${fmtAmount(parsedAmount)} on your order #${orderId}.${note ? ` Note: ${note}` : ""}`,
        entityType: "ORDER",
        entityId: orderId,
        data: {
          amount: fmtAmount(parsedAmount),
          recordType,
          serviceOrderId: serviceOrderId || null,
          note: note || null,
        },
      });

      return {
        id: record.id,
        orderId,
        serviceOrderId: serviceOrderId || null,
        type: recordType,
        amount: parsedAmount,
        note: note || null,
        createdBy: adminUserId,
        createdAt: record.createdAt,
      };
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  // POST: checkout cart in one shot — generate order + set address/delivery + confirm payment
  async checkoutCart(userId, cartId, addressId, deliveryOption, walletType) {
    const validOptions = ["standard", "express", "overnight"];
    if (deliveryOption && !validOptions.includes(deliveryOption)) {
      throw clientError("Invalid delivery option. Must be: standard, express, overnight.", 400, "VALIDATION_ERROR");
    }

    // Buyer chooses which wallet to pay from (defaults to PERSONAL)
    const VALID_WALLET_TYPES = ["PERSONAL", "COMPANY"];
    const buyerWalletType = walletType || "PERSONAL";
    if (!VALID_WALLET_TYPES.includes(buyerWalletType)) {
      throw clientError("Invalid walletType. Must be PERSONAL or COMPANY.", 400, "VALIDATION_ERROR");
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

    const buyerWallet = await Wallet.findOne({ where: { userId, walletType: buyerWalletType } });
    if (!buyerWallet) throw clientError(`Buyer ${buyerWalletType} wallet not found.`, 402, "NO_WALLET");
    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < orderTotal) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: orderTotal, available: buyerBalance };
      throw err;
    }

    // Resolve each service's payout wallet (keyed by serviceId):
    //   - service.payoutWalletId if the provider has chosen one
    //   - else fallback to the owner's wallet, COMPANY-first
    const serviceWalletMap = {};
    for (const od of orderItemsData) {
      if (serviceWalletMap[od.svc.id]) continue;

      let ownerWallet = null;
      if (od.svc.payoutWalletId) {
        ownerWallet = await Wallet.findByPk(od.svc.payoutWalletId);
      }
      if (!ownerWallet) {
        ownerWallet = await Wallet.findOne({
          where: { userId: od.svc.userId },
          order: [["walletType", "ASC"]],
        });
      }
      if (!ownerWallet) throw clientError(`Payout wallet not found for service owner ${od.svc.userId}.`, 500, "PAYMENT_ERROR");
      serviceWalletMap[od.svc.id] = ownerWallet;
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
          paidAmount: orderTotal,
          orderNo: `CO-${Date.now()}-${userId}`,
          image: "",
        },
        { transaction: tx }
      );

      const distributions = [];

      for (const od of orderItemsData) {
        const addOnSubtotalFinal = od.addOns.reduce((sum, a) => sum + parseFloat(a.price) * a.quantity, 0);

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
            paidAmount: od.finalAmount + addOnSubtotalFinal,
            status: "PURCHASED",
          },
          { transaction: tx }
        );

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
        const ownerWallet = serviceWalletMap[od.svc.id];

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
            orderId: order.id,
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

      await notifyServiceOwners(distributions, {
        buyerId: userId,
        orderId: order.id,
        type: "SERVICE_ORDER_PURCHASED",
        title: "New Order Purchased",
        messageFor: (buyerName, entry) =>
          `${buyerName} purchased your service order(s) for ${fmtAmount(entry.amount)} (Order #${order.id}). The amount has been credited to your wallet.`,
      });

      return {
        orderId: order.id,
        userId,
        cartId,
        status: "CONFIRMED",
        addressId,
        deliveryOption,
        totalAmount: orderTotal,
        paymentDetails: {
          buyerWallet: { id: buyerWallet.id, walletType: buyerWalletType, deducted: orderTotal },
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
  async listOrders(userId, statuses, {
    pagination = false,
    page = 1,
    limit = 20,
    includeTeams = false,
    includeMembers = false,
    includeCategories = false,
    includeAddOns = false,
    isLiked = false,
  } = {}) {
    const includeOptions = { includeTeams, includeMembers, includeCategories, includeAddOns, isLiked };
    const where = { userId };
    if (statuses && statuses.length > 0) where.status = statuses;
    console.log("listOrders where:", where);

    let orders;
    let paginationMeta = null;

    if (pagination) {
      const { count, rows } = await Order.findAndCountAll({
        where,
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      });
      orders = rows;
      paginationMeta = {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        limit,
      };
    } else {
      orders = await Order.findAll({
        where,
        order: [["createdAt", "DESC"]],
      });
    }

    const serviceCache = new Map();
    const result = [];
    for (const o of orders) {
      const serviceOrders = await ServiceOrder.findAll({ where: { orderId: o.id } });
      const services = await Promise.all(
        serviceOrders.map(async (so) => {
          const [addOns, service] = await Promise.all([
            ServiceOrderAddOn.findAll({
              where: { serviceOrderId: so.id },
              include: [{ model: ServiceAddOn, as: "addOn", attributes: ["id", "title", "description"] }],
            }),
            this.loadFullService(so.serviceId, userId, serviceCache, includeOptions),
          ]);
          const addOnSubtotal = addOns.reduce((s, a) => s + parseFloat(a.subtotal), 0);
          const itemTotal = parseFloat(so.finalAmount) + addOnSubtotal;
          return {
            serviceOrderId: so.id,
            serviceId: so.serviceId,
            quantity: so.quantity,
            finalAmount: parseFloat(so.finalAmount),
            paidAmount: parseFloat(so.paidAmount),
            extraPayments: parseFloat(so.extraPayments),
            addOns: addOns.map((a) => ({
              id: a.id,
              addOnId: a.addOnId,
              title: a.addOn ? a.addOn.title : null,
              description: a.addOn ? a.addOn.description : null,
              quantity: a.quantity,
              priceAtOrder: parseFloat(a.priceAtOrder),
              subtotal: parseFloat(a.subtotal),
            })),
            itemTotal,
            balanceDue: Math.max(0, itemTotal - parseFloat(so.paidAmount)),
            status: so.status,
            service,
          };
        })
      );
      // Order-level totals are summed from the items (each item's itemTotal =
      // finalAmount + add-ons, and its own paidAmount), not read from the order row —
      // the order columns can drift, and add-ons only live on the items.
      const totalAmount = services.reduce((sum, s) => sum + s.itemTotal, 0);
      const paidAmount = services.reduce((sum, s) => sum + s.paidAmount, 0);
      const extraPayments = services.reduce((sum, s) => sum + s.extraPayments, 0);

      result.push({
        orderId: o.id,
        cartId: o.cartId,
        status: o.status,
        totalAmount,
        paidAmount,
        extraPayments,
        balanceDue: Math.max(0, totalAmount - paidAmount),
        createdAt: o.createdAt,
        services,
      });
    }
    return { orders: result, pagination: paginationMeta };
  }

  // Get single order with items.
  // Accessible by the buyer (full order, all items) OR by a service owner who has
  // at least one of their services in this order (scoped to just their own item(s) —
  // they don't see other providers' items, pricing, or payment history).
  async getOrder(userId, orderId, includeOptions = {}) {
    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");

    const buyer = await User.findByPk(order.userId, {
      attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
      include: [{ model: Role, as: "roles", attributes: ["name"], through: { attributes: [] } }],
    });

    const isBuyer = order.userId === userId;
    let ownedServiceOrderIds = null; // null = buyer view, no scoping

    if (!isBuyer) {
      const ownedItems = await ServiceOrder.findAll({
        where: { orderId, serviceOwnerId: userId },
        attributes: ["id"],
      });
      if (ownedItems.length === 0) throw clientError("Order not found.", 404, "NOT_FOUND");
      ownedServiceOrderIds = ownedItems.map((so) => so.id);
    }

    const serviceOrderWhere = ownedServiceOrderIds ? { orderId, id: ownedServiceOrderIds } : { orderId };
    const serviceOrders = await ServiceOrder.findAll({ where: serviceOrderWhere });
    const serviceCache = new Map();
    const items = [];
    for (const so of serviceOrders) {
      const [addOns, service] = await Promise.all([
        ServiceOrderAddOn.findAll({
          where: { serviceOrderId: so.id },
          include: [{ model: ServiceAddOn, as: "addOn", attributes: ["id", "title", "description"] }],
        }),
        this.loadFullService(so.serviceId, userId, serviceCache, includeOptions),
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
        paidAmount: parseFloat(so.paidAmount),
        extraPayments: parseFloat(so.extraPayments),
        addOns: addOns.map((a) => ({
          id: a.id,
          addOnId: a.addOnId,
          title: a.addOn ? a.addOn.title : null,
          description: a.addOn ? a.addOn.description : null,
          quantity: a.quantity,
          priceAtOrder: parseFloat(a.priceAtOrder),
          subtotal: parseFloat(a.subtotal),
        })),
        itemTotal: parseFloat(so.finalAmount) + addOnSubtotal,
        status: so.status,
        service,
      });
    }

    let paymentHistory = await this._fetchPaymentHistoryRows(orderId);

    // Order-level totals are always summed from the items (itemTotal = finalAmount +
    // add-ons, and each item's own paidAmount) rather than read from the order row —
    // the order columns can drift and don't reflect post-order add-on charges. For a
    // service owner this is already scoped to just their own items above.
    const totalAmount = items.reduce((sum, it) => sum + it.itemTotal, 0);
    const paidAmount = items.reduce((sum, it) => sum + it.paidAmount, 0);
    const extraPayments = items.reduce((sum, it) => sum + it.extraPayments, 0);

    if (ownedServiceOrderIds) {
      paymentHistory = paymentHistory.filter(
        (p) => p.serviceOrderId != null && ownedServiceOrderIds.includes(p.serviceOrderId)
      );
    }

    return {
      orderId: order.id,
      userId: order.userId,
      buyer: buyer
        ? {
            id: buyer.id,
            firstName: buyer.firstName,
            lastName: buyer.lastName,
            username: buyer.username,
            email: buyer.email,
            profilePic: buyer.profilePic,
            roles: (buyer.roles || []).map((r) => r.name),
          }
        : null,
      cartId: order.cartId,
      status: order.status,
      addressId: order.addressId,
      deliveryOption: order.deliveryOption,
      viewerRole: isBuyer ? "buyer" : "service_owner",
      totalAmount,
      paidAmount,
      extraPayments,
      balanceDue: Math.max(0, totalAmount - paidAmount),
      items,
      paymentHistory,
      createdAt: order.createdAt,
    };
  }

  // POST: admin/accountant adds one or more additional charges (catalog add-ons) to
  // a placed order in a single call. The caller passes the order id and an array of
  // add-on ids; each add-on is routed to the order's service item that belongs to the
  // same service. Inserts service_order_add_ons rows and raises the parent order's
  // price by the total, leaving paidAmount untouched so a balance becomes due that the
  // buyer settles via top-up. All-or-nothing: any invalid add-on fails the whole call.
  //
  // addOns: array of ids [12, 15] or objects [{ addOnId, quantity }]. Duplicate ids
  // are allowed and stack (each becomes its own row / quantity).
  async addOrderAddOns(actorUserId, orderId, addOns) {
    if (!Array.isArray(addOns) || addOns.length === 0) {
      throw clientError("addOns must be a non-empty array.", 400, "VALIDATION_ERROR");
    }

    // Normalize [id] | [{addOnId, quantity}] → [{ addOnId, quantity }]
    const requested = addOns.map((entry) => {
      const addOnId = Number(typeof entry === "object" && entry !== null ? entry.addOnId : entry);
      const quantity = Number(typeof entry === "object" && entry !== null ? (entry.quantity ?? 1) : 1);
      if (!addOnId || Number.isNaN(addOnId)) {
        throw clientError("Each add-on must have a valid addOnId.", 400, "VALIDATION_ERROR");
      }
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw clientError("quantity must be a positive integer.", 400, "VALIDATION_ERROR");
      }
      return { addOnId, quantity };
    });

    const order = await Order.findByPk(orderId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");

    // Authorize: admin/accountant only (an order can span multiple service owners).
    const actor = await User.findByPk(actorUserId, {
      include: [{ model: Role, as: "roles", attributes: ["name"], through: { attributes: [] } }],
    });
    const roles = (actor?.roles || []).map((r) => r.name);
    if (!roles.includes("admin") && !roles.includes("accountant")) {
      throw clientError("Forbidden. Only an admin or accountant can add charges.", 403, "UNAUTHORIZED");
    }

    const serviceOrders = await ServiceOrder.findAll({ where: { orderId } });
    if (serviceOrders.length === 0) throw clientError("Order has no items.", 400, "EMPTY_ORDER");

    // Map serviceId → the order's service item(s). Route each add-on to the item that
    // shares its service. Ambiguous (same service twice in one order) → first match.
    const soByService = new Map();
    for (const so of serviceOrders) {
      if (!soByService.has(so.serviceId)) soByService.set(so.serviceId, so);
    }

    // Resolve every requested add-on against the catalog + this order's items first,
    // so we can reject the whole batch before writing anything.
    const uniqueAddOnIds = [...new Set(requested.map((r) => r.addOnId))];
    const catalog = await ServiceAddOn.findAll({
      where: { id: uniqueAddOnIds, deletedAt: null },
    });
    const catalogById = new Map(catalog.map((a) => [a.id, a]));

    const resolved = requested.map(({ addOnId, quantity }) => {
      const addOn = catalogById.get(addOnId);
      if (!addOn) throw clientError(`Add-on ${addOnId} not found.`, 404, "NOT_FOUND");
      const so = soByService.get(addOn.serviceId);
      if (!so) {
        throw clientError(
          `Add-on ${addOnId} belongs to a service that is not part of this order.`,
          400,
          "VALIDATION_ERROR"
        );
      }
      const priceAtOrder = parseFloat(addOn.amount);
      const subtotal = priceAtOrder * quantity;
      return { addOn, serviceOrder: so, quantity, priceAtOrder, subtotal };
    });

    const grandTotal = resolved.reduce((s, r) => s + r.subtotal, 0);

    const tx = await sequelize.transaction();
    try {
      const created = [];
      for (const r of resolved) {
        const orderAddOn = await ServiceOrderAddOn.create(
          {
            serviceOrderId: r.serviceOrder.id,
            addOnId: r.addOn.id,
            quantity: r.quantity,
            priceAtOrder: r.priceAtOrder,
            subtotal: r.subtotal,
          },
          { transaction: tx }
        );
        created.push({ r, orderAddOn });
      }

      // Raise the parent order's price by the batch total. Item totals are derived as
      // finalAmount + sum(add-on subtotals) on read, so finalAmount is left untouched
      // to avoid double-counting the add-ons we just inserted.
      await Order.update(
        { price: sequelize.literal(`price + ${grandTotal}`) },
        { where: { id: orderId }, transaction: tx }
      );

      await tx.commit();

      const updatedOrder = await Order.findByPk(orderId);

      // One notification to the buyer summarizing the added charges.
      await notifyServiceOwners(
        [{ serviceOwnerId: updatedOrder.userId, amount: grandTotal, serviceName: null }],
        {
          buyerId: actorUserId,
          orderId,
          type: "SERVICE_ORDER_ADDON_CHARGE",
          title: "Additional Charges Added",
          messageFor: (actorName, entry) =>
            `Additional charges of ${fmtAmount(entry.amount)} were added to your Order #${orderId}. Please pay the outstanding balance.`,
        }
      );

      return {
        orderId,
        addedCount: created.length,
        totalCharged: grandTotal,
        addOns: created.map(({ r, orderAddOn }) => ({
          id: orderAddOn.id,
          addOnId: r.addOn.id,
          title: r.addOn.title,
          serviceId: r.addOn.serviceId,
          serviceOrderId: r.serviceOrder.id,
          quantity: r.quantity,
          priceAtOrder: r.priceAtOrder,
          subtotal: r.subtotal,
        })),
        orderTotals: {
          totalAmount: parseFloat(updatedOrder.price),
          paidAmount: parseFloat(updatedOrder.paidAmount),
          balanceDue: parseFloat(updatedOrder.price) - parseFloat(updatedOrder.paidAmount),
        },
      };
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Failed to add charges. Please retry.", 500, "ADDON_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // GET: service owner — list all orders containing their service(s), grouped by
  // order (one entry per order, with a nested `services` array — not one flat row
  // per service item, since a single order can hold multiple of the owner's services).
  async getOrdersForServiceOwner(ownerId, serviceId, includeOptions = {}, {
    pagination = false,
    page = 1,
    limit = 20,
  } = {}) {
    const ownerWhere = { serviceOwnerId: ownerId };
    if (serviceId) ownerWhere.serviceId = serviceId;

    // Distinct set of orders that contain at least one of this owner's services
    const ownedServiceOrders = await ServiceOrder.findAll({ where: ownerWhere, attributes: ["orderId"] });
    const orderIds = [...new Set(ownedServiceOrders.map((so) => so.orderId))];

    let orders;
    let paginationMeta = null;

    if (pagination) {
      const { count, rows } = await Order.findAndCountAll({
        where: { id: orderIds },
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
      });
      orders = rows;
      paginationMeta = {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        limit,
      };
    } else {
      orders = await Order.findAll({
        where: { id: orderIds },
        order: [["createdAt", "DESC"]],
      });
    }

    const buyerIds = [...new Set(orders.map((o) => o.userId))];
    const buyers = buyerIds.length
      ? await User.findAll({
          where: { id: buyerIds },
          attributes: ["id", "firstName", "lastName", "username", "email", "profilePic"],
          include: [{ model: Role, as: "roles", attributes: ["name"], through: { attributes: [] } }],
        })
      : [];
    const buyerMap = Object.fromEntries(buyers.map((b) => [b.id, b]));

    const serviceCache = new Map();
    const results = [];
    for (const order of orders) {
      const serviceOrders = await ServiceOrder.findAll({ where: { ...ownerWhere, orderId: order.id } });

      const services = await Promise.all(
        serviceOrders.map(async (so) => {
          const addOns = await ServiceOrderAddOn.findAll({
            where: { serviceOrderId: so.id },
            include: [{ model: ServiceAddOn, as: "addOn", attributes: ["id", "title", "description"] }],
          });
          const service = await this.loadFullService(so.serviceId, ownerId, serviceCache, includeOptions);
          const addOnSubtotal = addOns.reduce((s, a) => s + parseFloat(a.subtotal), 0);
          const itemTotal = parseFloat(so.finalAmount) + addOnSubtotal;

          return {
            serviceOrderId: so.id,
            serviceId: so.serviceId,
            quantity: so.quantity,
            servicePriceAtOrder: parseFloat(so.servicePriceAtOrder),
            subtotal: parseFloat(so.subtotal),
            discountCode: so.discountCode,
            discountAmount: parseFloat(so.discountAmount),
            finalAmount: parseFloat(so.finalAmount),
            paidAmount: parseFloat(so.paidAmount),
            extraPayments: parseFloat(so.extraPayments),
            addOns: addOns.map((a) => ({
              id: a.id,
              addOnId: a.addOnId,
              title: a.addOn ? a.addOn.title : null,
              description: a.addOn ? a.addOn.description : null,
              quantity: a.quantity,
              priceAtOrder: parseFloat(a.priceAtOrder),
              subtotal: parseFloat(a.subtotal),
            })),
            itemTotal,
            balanceDue: Math.max(0, itemTotal - parseFloat(so.paidAmount)),
            status: so.status,
            service,
          };
        })
      );

      const buyer = buyerMap[order.userId];

      // Totals are scoped to just this owner's items (never leak other providers'
      // amounts), summed from the services above — same approach as the scoped view
      // in getOrder. balanceDue = owed − paid for these items only.
      const totalAmount = services.reduce((sum, s) => sum + s.itemTotal, 0);
      const paidAmount = services.reduce((sum, s) => sum + s.paidAmount, 0);
      const extraPayments = services.reduce((sum, s) => sum + s.extraPayments, 0);

      results.push({
        orderId: order.id,
        orderNo: order.orderNo,
        buyerId: order.userId,
        buyer: buyer
          ? {
              id: buyer.id,
              firstName: buyer.firstName,
              lastName: buyer.lastName,
              username: buyer.username,
              email: buyer.email,
              profilePic: buyer.profilePic,
              roles: (buyer.roles || []).map((r) => r.name),
            }
          : null,
        status: order.status,
        addressId: order.addressId,
        deliveryOption: order.deliveryOption,
        totalAmount,
        paidAmount,
        extraPayments,
        balanceDue: Math.max(0, totalAmount - paidAmount),
        createdAt: order.createdAt,
        services,
      });
    }

    return { results, pagination: paginationMeta };
  }
}

module.exports = OrderCartService;
