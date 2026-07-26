const sequelize = require("../config/database");
const {
  ProductCartItem,
  ShopProduct,
  ProductVariation,
  ProductAddOn,
  Wallet,
  WalletTransaction,
  User,
  Role,
} = require("../models");
const ProductOrderRepository = require("../repositories/ProductOrderRepository");
const NotificationService = require("./NotificationService");
const notificationService = new NotificationService();

function clientError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

function round2(n) {
  return parseFloat(Number(n).toFixed(2));
}

const VALID_WALLET_TYPES = ["PERSONAL", "COMPANY"];

// Forward-only lifecycle. cancelled/refunded/returned are terminal side-branches
// reachable from any non-terminal state; delivered is the normal terminal state.
const STATUS_FLOW = [
  "confirmed",
  "processing",
  "shipped",
  "in_transit",
  "customs",
  "out_for_delivery",
  "delivered",
];
const TERMINAL_STATUSES = ["cancelled", "refunded", "returned", "delivered"];
const REFUNDING_STATUSES = ["cancelled", "refunded"];

// One notification per shop owner about the shop-order they just received.
// Never throws — a failed notification must not break checkout.
async function notifyShopOwnerOfNewOrder({ shopOwnerId, buyerId, shopOrder }) {
  if (!shopOwnerId || shopOwnerId === buyerId) return;
  try {
    const buyer = await User.findByPk(buyerId, { attributes: ["id", "username", "email"] });
    const buyerName = (buyer && (buyer.username || buyer.email)) || `User #${buyerId}`;

    await notificationService.notifyUser({
      userId: shopOwnerId,
      actorId: buyerId,
      type: "PRODUCT_ORDER_CREATED",
      title: "New order received",
      message: `${buyerName} placed an order (#${shopOrder.orderNo}) for ${round2(shopOrder.totalAmount)}.`,
      entityType: "PRODUCT_SHOP_ORDER",
      entityId: shopOrder.id,
      data: { orderNo: shopOrder.orderNo, amount: round2(shopOrder.totalAmount), buyerName },
    });
  } catch (error) {
    console.error("notifyShopOwnerOfNewOrder error:", error.message);
  }
}

// Notifies the buyer their shop-order's status changed. Never throws.
async function notifyBuyerOfStatusChange({ buyerId, actorId, shopOrder, nextStatus }) {
  try {
    await notificationService.notifyUser({
      userId: buyerId,
      actorId,
      type: "PRODUCT_ORDER_STATUS_UPDATED",
      title: "Order status updated",
      message: `Your order #${shopOrder.orderNo} is now "${nextStatus}".`,
      entityType: "PRODUCT_SHOP_ORDER",
      entityId: shopOrder.id,
      data: { orderNo: shopOrder.orderNo, status: nextStatus },
    });
  } catch (error) {
    console.error("notifyBuyerOfStatusChange error:", error.message);
  }
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

class ProductOrderService {
  constructor() {
    this.repo = new ProductOrderRepository();
  }

  // ── Authorization ────────────────────────────────────────────────────────

  async _isAdmin(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Role, as: "roles", attributes: ["name"], through: { attributes: [] } }],
    });
    return (user?.roles || []).some((r) => r.name === "admin");
  }

  async _assertOwnerOrAdmin(shopOrder, userId) {
    const shop = await this.repo.fetchShop(shopOrder.shopId);
    if (shop && shop.userId === userId) return;
    if (await this._isAdmin(userId)) return;
    throw clientError("Forbidden. Only the shop owner or an admin can perform this action.", 403, "UNAUTHORIZED");
  }

  // ── Checkout: cart -> parent order + one shop-order per shop ────────────

  async checkout(userId, { addressId, deliveryType, note, walletId }) {
    if (walletId === undefined || walletId === null || walletId === "") {
      throw clientError("walletId is required.", 422, "VALIDATION_ERROR");
    }

    // The wallet id itself pins down both currency and walletType — no
    // ambiguity, unlike resolving "PERSONAL" alone when a buyer holds several
    // PERSONAL wallets in different currencies.
    const buyerWallet = await this.repo.fetchWalletById(Number(walletId));
    if (!buyerWallet || buyerWallet.userId !== userId) {
      throw clientError("Wallet not found.", 404, "NO_WALLET");
    }
    const chosenWalletType = buyerWallet.walletType;

    const cartLines = await ProductCartItem.findAll({
      where: { userId },
      include: [
        { model: ShopProduct, as: "product" },
        { model: ProductVariation, as: "variation" },
      ],
    });
    if (cartLines.length === 0) {
      throw clientError("Your cart is empty.", 400, "EMPTY_CART");
    }

    let address = null;
    if (addressId !== undefined && addressId !== null) {
      address = await this.repo.fetchAddress(Number(addressId), userId);
      if (!address) throw clientError("Address not found.", 404, "ADDRESS_NOT_FOUND");
    }

    // Live stock re-check (prices/discounts/add-ons are trusted from the cart
    // snapshot as-is, per design — only stock is re-verified here).
    for (const line of cartLines) {
      const available = line.variationId ? Number(line.variation?.stock ?? 0) : Number(line.product?.quantity ?? 0);
      if (line.productCartItemQuantity > available) {
        const name = line.product?.name || `product #${line.shopProductId}`;
        throw clientError(`Only ${available} unit(s) of "${name}" available.`, 400, "OUT_OF_STOCK");
      }
    }

    // Group lines by shop.
    const byShop = new Map();
    for (const line of cartLines) {
      const shopId = line.product?.shopId;
      if (!shopId) throw clientError(`Product #${line.shopProductId} has no shop.`, 500, "DATA_ERROR");
      if (!byShop.has(shopId)) byShop.set(shopId, []);
      byShop.get(shopId).push(line);
    }

    // Resolve every shop's payout wallet up front, and validate currency match
    // against the buyer's wallet BEFORE any money moves.
    const shopWalletMap = new Map();
    for (const shopId of byShop.keys()) {
      const shop = await this.repo.fetchShop(shopId);
      if (!shop) throw clientError(`Shop #${shopId} not found.`, 404, "NOT_FOUND");

      let payoutWallet = shop.payoutWalletId ? await this.repo.fetchWalletById(shop.payoutWalletId) : null;
      if (!payoutWallet) {
        payoutWallet = await Wallet.findOne({ where: { userId: shop.userId }, order: [["walletType", "ASC"]] });
      }
      if (!payoutWallet) {
        throw clientError(`Shop "${shop.name}" has no payout wallet configured.`, 500, "NO_PAYOUT_WALLET");
      }
      if (payoutWallet.currency !== buyerWallet.currency) {
        throw clientError(
          `Shop "${shop.name}"'s payout wallet currency (${payoutWallet.currency}) does not match your wallet currency (${buyerWallet.currency}).`,
          402,
          "CURRENCY_MISMATCH"
        );
      }
      shopWalletMap.set(shopId, { shop, payoutWallet });
    }

    // Compute each shop-order's totals from the cart snapshot as-is.
    const shopOrderPlans = [];
    let grandTotal = 0;
    for (const [shopId, lines] of byShop.entries()) {
      let subtotal = 0;
      let discountAmount = 0;
      let addOnAmount = 0;
      const itemRows = [];

      for (const line of lines) {
        const lineSubtotal = round2(Number(line.unitPriceSnapshot) * line.productCartItemQuantity);
        const lineDiscount = round2(Number(line.discountAmount));
        const lineAddOns = round2((line.addOns || []).reduce((sum, a) => sum + Number(a.price) * Number(a.quantity ?? 1), 0));
        const lineTotal = round2(lineSubtotal - lineDiscount + lineAddOns);

        subtotal += lineSubtotal;
        discountAmount += lineDiscount;
        addOnAmount += lineAddOns;

        itemRows.push({
          shopProductId: line.shopProductId,
          variationId: line.variationId,
          productCartItemQuantity: line.productCartItemQuantity,
          unitPriceSnapshot: line.unitPriceSnapshot,
          discountCode: line.discountCode,
          discountPercent: line.discountPercent,
          discountAmount: lineDiscount,
          addOns: line.addOns || [],
          subtotal: lineTotal,
        });
      }

      const totalAmount = round2(subtotal - discountAmount + addOnAmount);
      grandTotal += totalAmount;

      shopOrderPlans.push({
        shopId,
        lines,
        itemRows,
        subtotal: round2(subtotal),
        discountAmount: round2(discountAmount),
        addOnAmount: round2(addOnAmount),
        totalAmount,
      });
    }
    grandTotal = round2(grandTotal);

    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < grandTotal) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: grandTotal, available: buyerBalance };
      throw err;
    }

    const parentOrderNo = `PO-${Date.now()}-${randomSuffix()}`;

    const tx = await sequelize.transaction();
    try {
      const parentOrder = await this.repo.createParentOrder(
        {
          orderNo: parentOrderNo,
          userId,
          addressId: address ? address.id : null,
          deliveryType: deliveryType || null,
          note: note || null,
          walletType: chosenWalletType,
          totalAmount: grandTotal,
        },
        tx
      );

      // Debit the buyer once for the whole checkout.
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${grandTotal}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );

      const createdShopOrders = [];
      let shopIndex = 0;
      for (const plan of shopOrderPlans) {
        shopIndex += 1;
        const { payoutWallet } = shopWalletMap.get(plan.shopId);

        const shopOrder = await this.repo.createShopOrder(
          {
            orderNo: `${parentOrderNo}-${shopIndex}`,
            parentOrderId: parentOrder.id,
            shopId: plan.shopId,
            userId,
            status: "confirmed",
            subtotal: plan.subtotal,
            discountAmount: plan.discountAmount,
            addOnAmount: plan.addOnAmount,
            chargesAmount: 0,
            totalAmount: plan.totalAmount,
            paidAmount: plan.totalAmount,
            payoutWalletId: payoutWallet.id,
          },
          tx
        );

        await this.repo.createShopOrderItems(
          plan.itemRows.map((row) => ({ ...row, shopOrderId: shopOrder.id })),
          tx
        );

        // Credit the shop's payout wallet for its slice.
        await Wallet.update(
          { availableBalance: sequelize.literal(`availableBalance + ${plan.totalAmount}`) },
          { where: { id: payoutWallet.id }, transaction: tx }
        );

        await WalletTransaction.create(
          {
            walletId: buyerWallet.id,
            userId,
            receiverId: shopWalletMap.get(plan.shopId).shop.userId,
            type: "TRANSFER",
            amount: plan.totalAmount,
            currency: buyerWallet.currency,
            description: `Payment for shop order #${shopOrder.orderNo}`,
            referenceType: "PRODUCT_SHOP_ORDER",
            referenceId: shopOrder.id,
            orderId: parentOrder.id,
            performedBy: userId,
          },
          { transaction: tx }
        );

        // Decrement stock / bump soldQuantity for each line, in the same transaction.
        for (const line of plan.lines) {
          if (line.variationId) {
            await ProductVariation.update(
              {
                stock: sequelize.literal(`stock - ${line.productCartItemQuantity}`),
                soldQuantity: sequelize.literal(`soldQuantity + ${line.productCartItemQuantity}`),
              },
              { where: { id: line.variationId }, transaction: tx }
            );
          } else {
            await ShopProduct.update(
              {
                quantity: sequelize.literal(`quantity - ${line.productCartItemQuantity}`),
                soldQuantity: sequelize.literal(`soldQuantity + ${line.productCartItemQuantity}`),
              },
              { where: { id: line.shopProductId }, transaction: tx }
            );
          }
        }

        createdShopOrders.push(shopOrder);
      }

      // Clear the cart lines that were just converted.
      await ProductCartItem.destroy({
        where: { id: cartLines.map((l) => l.id) },
        transaction: tx,
      });

      await tx.commit();

      for (const shopOrder of createdShopOrders) {
        const shopOwnerId = shopWalletMap.get(shopOrder.shopId).shop.userId;
        await notifyShopOwnerOfNewOrder({ shopOwnerId, buyerId: userId, shopOrder });
      }

      return this.repo.findParentOrderForUser(parentOrder.id, userId);
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Checkout failed. No funds were deducted. Please retry.", 500, "PAYMENT_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // ── Status updates ───────────────────────────────────────────────────────

  // Forward-only within STATUS_FLOW; cancelled/refunded/returned are reachable
  // from any non-terminal state as side-branches. Once a shop-order is in a
  // terminal state, no further transition is allowed (admin included) — a
  // mis-set terminal status is a data-correction problem, not a status update.
  _assertValidTransition(currentStatus, nextStatus) {
    if (TERMINAL_STATUSES.includes(currentStatus)) {
      throw clientError(`Order is already ${currentStatus} and cannot be changed further.`, 409, "INVALID_STATE");
    }

    if (REFUNDING_STATUSES.includes(nextStatus) || nextStatus === "returned") {
      return; // side-branch, reachable from any non-terminal state
    }

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    const nextIndex = STATUS_FLOW.indexOf(nextStatus);
    if (nextIndex === -1) {
      throw clientError(`Invalid status "${nextStatus}".`, 422, "VALIDATION_ERROR");
    }
    if (nextIndex <= currentIndex) {
      throw clientError(
        `Cannot move status backward from "${currentStatus}" to "${nextStatus}".`,
        409,
        "INVALID_STATE"
      );
    }
  }

  async updateShopOrderStatus(actorUserId, shopOrderId, nextStatus) {
    const shopOrder = await this.repo.findShopOrderForOwnerCheck(shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");

    await this._assertOwnerOrAdmin(shopOrder, actorUserId);
    this._assertValidTransition(shopOrder.status, nextStatus);

    const isRefunding = REFUNDING_STATUSES.includes(nextStatus);

    const tx = await sequelize.transaction();
    try {
      await this.repo.updateShopOrder(shopOrderId, { status: nextStatus }, tx);

      if (isRefunding) {
        await this._refundAndRestoreStock(shopOrder, actorUserId, tx);
      }

      await tx.commit();

      await notifyBuyerOfStatusChange({
        buyerId: shopOrder.userId,
        actorId: actorUserId,
        shopOrder,
        nextStatus,
      });

      return this.repo.findShopOrder(shopOrderId);
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Status update failed. Please retry.", 500, "STATUS_UPDATE_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // Credits the buyer back what they actually paid on this shop-order (checkout
  // amount + any paid charges), debits it back out of the payout wallet, and
  // restores stock/soldQuantity for every line item — symmetric to checkout.
  async _refundAndRestoreStock(shopOrder, actorUserId, tx) {
    const refundAmount = parseFloat(shopOrder.paidAmount);

    if (refundAmount > 0) {
      const payoutWallet = await this.repo.fetchWalletById(shopOrder.payoutWalletId);
      if (!payoutWallet) {
        throw clientError("Payout wallet no longer exists — cannot process refund automatically.", 500, "NO_PAYOUT_WALLET");
      }

      const buyerWallet = await Wallet.findOne({
        where: { userId: shopOrder.userId, currency: payoutWallet.currency },
        order: [["walletType", "ASC"]],
      });
      if (!buyerWallet) {
        throw clientError("Buyer's original wallet currency not found — cannot process refund automatically.", 500, "NO_WALLET");
      }

      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${refundAmount}`) },
        { where: { id: payoutWallet.id }, transaction: tx }
      );
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance + ${refundAmount}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );

      await WalletTransaction.create(
        {
          walletId: buyerWallet.id,
          userId: shopOrder.userId,
          receiverId: null,
          type: "TRANSFER",
          amount: refundAmount,
          currency: buyerWallet.currency,
          description: `Refund for shop order #${shopOrder.orderNo}`,
          referenceType: "PRODUCT_SHOP_ORDER_REFUND",
          referenceId: shopOrder.id,
          orderId: shopOrder.parentOrderId,
          performedBy: actorUserId,
        },
        { transaction: tx }
      );
    }

    const items = await this.repo.findShopOrder(shopOrder.id);
    for (const item of items.items) {
      if (item.variationId) {
        await ProductVariation.update(
          {
            stock: sequelize.literal(`stock + ${item.productCartItemQuantity}`),
            soldQuantity: sequelize.literal(`GREATEST(soldQuantity - ${item.productCartItemQuantity}, 0)`),
          },
          { where: { id: item.variationId }, transaction: tx }
        );
      } else {
        await ShopProduct.update(
          {
            quantity: sequelize.literal(`quantity + ${item.productCartItemQuantity}`),
            soldQuantity: sequelize.literal(`GREATEST(soldQuantity - ${item.productCartItemQuantity}, 0)`),
          },
          { where: { id: item.shopProductId }, transaction: tx }
        );
      }
    }
  }

  // ── Post-order charges (e.g. shipping/transport) ────────────────────────

  // If addOnId is given, the add-on must belong to a product/variation that is
  // actually a line item in THIS shop-order (not just any add-on from the shop)
  // — name/amount are then always taken from the ProductAddOn row itself, never
  // from the request, so a charge can't silently diverge from the catalog price.
  async _resolveChargeAddOn(shopOrder, addOnId) {
    const addOn = await ProductAddOn.findByPk(addOnId);
    if (!addOn) throw clientError("Add-on not found.", 404, "NOT_FOUND");

    const items = shopOrder.items || (await this.repo.findShopOrder(shopOrder.id)).items;
    const belongsToOrder = items.some((item) =>
      addOn.variationId ? item.variationId === addOn.variationId : item.shopProductId === addOn.shopProductId
    );
    if (!belongsToOrder) {
      throw clientError("This add-on does not belong to any product in this order.", 422, "VALIDATION_ERROR");
    }

    return { name: addOn.name, amount: Number(addOn.price) };
  }

  async addCharge(actorUserId, shopOrderId, { name, description, amount, addOnId }) {
    const shopOrder = await this.repo.findShopOrderForOwnerCheck(shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");

    await this._assertOwnerOrAdmin(shopOrder, actorUserId);

    if (TERMINAL_STATUSES.includes(shopOrder.status)) {
      throw clientError(`Cannot add a charge to a ${shopOrder.status} order.`, 409, "INVALID_STATE");
    }

    let chargeName = name;
    let chargeAmount = amount;

    if (addOnId !== undefined && addOnId !== null && addOnId !== "") {
      const resolved = await this._resolveChargeAddOn(shopOrder, Number(addOnId));
      chargeName = resolved.name;
      chargeAmount = resolved.amount;
    } else {
      if (!name || !String(name).trim()) {
        throw clientError("Charge name is required.", 422, "VALIDATION_ERROR");
      }
      const amt = Number(amount);
      if (Number.isNaN(amt) || amt <= 0) {
        throw clientError("Charge amount must be a number greater than 0.", 422, "VALIDATION_ERROR");
      }
      chargeAmount = amt;
    }

    const tx = await sequelize.transaction();
    try {
      const charge = await this.repo.createCharge(
        {
          shopOrderId,
          addOnId: addOnId ? Number(addOnId) : null,
          name: String(chargeName).trim(),
          description: description != null ? String(description).trim() : null,
          amount: chargeAmount,
          addedBy: actorUserId,
          isPaid: false,
        },
        tx
      );

      await this.repo.incrementShopOrderTotals(
        shopOrderId,
        { chargesAmount: chargeAmount, totalAmount: chargeAmount },
        tx
      );

      await tx.commit();
      return charge;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }

  // Buyer pays a specific due charge from a wallet of their choosing (which may
  // differ from the wallet used at checkout).
  async payCharge(userId, chargeId, walletId) {
    const charge = await this.repo.findChargeOrFail(chargeId);
    if (charge.isPaid) throw clientError("This charge has already been paid.", 409, "ALREADY_PAID");

    const shopOrder = await this.repo.findShopOrderForOwnerCheck(charge.shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");
    if (shopOrder.userId !== userId) throw clientError("Forbidden.", 403, "UNAUTHORIZED");

    if (walletId === undefined || walletId === null || walletId === "") {
      throw clientError("walletId is required.", 422, "VALIDATION_ERROR");
    }
    const buyerWallet = await this.repo.fetchWalletById(Number(walletId));
    if (!buyerWallet || buyerWallet.userId !== userId) {
      throw clientError("Wallet not found.", 404, "NO_WALLET");
    }

    const payoutWallet = await this.repo.fetchWalletById(shopOrder.payoutWalletId);
    if (!payoutWallet) {
      throw clientError("This shop's payout wallet is no longer available.", 500, "NO_PAYOUT_WALLET");
    }
    if (payoutWallet.currency !== buyerWallet.currency) {
      throw clientError(
        `This charge's payout wallet currency (${payoutWallet.currency}) does not match your wallet currency (${buyerWallet.currency}).`,
        402,
        "CURRENCY_MISMATCH"
      );
    }

    const amount = parseFloat(charge.amount);
    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < amount) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: amount, available: buyerBalance };
      throw err;
    }

    const tx = await sequelize.transaction();
    try {
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${amount}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance + ${amount}`) },
        { where: { id: payoutWallet.id }, transaction: tx }
      );

      await WalletTransaction.create(
        {
          walletId: buyerWallet.id,
          userId,
          receiverId: null,
          type: "TRANSFER",
          amount,
          currency: buyerWallet.currency,
          description: `Payment for charge "${charge.name}" on shop order #${shopOrder.orderNo}`,
          referenceType: "PRODUCT_SHOP_ORDER_CHARGE",
          referenceId: charge.id,
          orderId: shopOrder.parentOrderId,
          performedBy: userId,
        },
        { transaction: tx }
      );

      await this.repo.markChargePaid(charge.id, tx);
      await this.repo.incrementShopOrderTotals(shopOrder.id, { paidAmount: amount }, tx);

      await tx.commit();
      return this.repo.findShopOrder(shopOrder.id);
    } catch (error) {
      await tx.rollback();
      if (!error.statusCode) {
        const wrapped = clientError("Payment failed. Please retry.", 500, "PAYMENT_ERROR");
        wrapped.original = error.message;
        throw wrapped;
      }
      throw error;
    }
  }

  // ── Lists ────────────────────────────────────────────────────────────────

  async getMyOrders(userId, { page = 1, limit = 10 } = {}) {
    const { total, rows } = await this.repo.listParentOrdersForBuyer(userId, { page: Number(page), limit: Number(limit) });
    return {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      orders: rows,
    };
  }

  async getShopOrders(actorUserId, shopId, { page = 1, limit = 10, status } = {}) {
    const shop = await this.repo.fetchShop(shopId);
    if (!shop) throw clientError("Shop not found.", 404, "NOT_FOUND");
    if (shop.userId !== actorUserId && !(await this._isAdmin(actorUserId))) {
      throw clientError("Forbidden. Only the shop owner or an admin can view this shop's orders.", 403, "UNAUTHORIZED");
    }

    const { total, rows } = await this.repo.listShopOrdersForShop(shopId, {
      page: Number(page),
      limit: Number(limit),
      status,
    });
    return {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      orders: rows,
    };
  }

  // Orders across every shop the caller owns — no single shopId, so no
  // ownership check is needed beyond scoping the query to the caller's id.
  async getShopOrdersForOwner(actorUserId, { page = 1, limit = 10, status } = {}) {
    const { total, rows } = await this.repo.listShopOrdersForOwner(actorUserId, {
      page: Number(page),
      limit: Number(limit),
      status,
    });
    return {
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      orders: rows,
    };
  }

  async getParentOrder(userId, parentOrderId) {
    const order = await this.repo.findParentOrderForUser(parentOrderId, userId);
    if (!order) throw clientError("Order not found.", 404, "NOT_FOUND");
    return order;
  }

  async getShopOrder(actorUserId, shopOrderId) {
    const shopOrder = await this.repo.findShopOrder(shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");

    const isBuyer = shopOrder.userId === actorUserId;
    if (!isBuyer) {
      await this._assertOwnerOrAdmin(shopOrder, actorUserId);
    }
    return shopOrder;
  }
}

module.exports = ProductOrderService;
