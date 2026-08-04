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

          // Add-on stock: decrement by each add-on's own quantity, as snapshotted on
          // the cart line — required add-ons are already scaled 1:1 with
          // productCartItemQuantity at add-to-cart time (see
          // ProductCartService._scaleRequiredAddOns), optional add-ons carry
          // whatever quantity the buyer chose independently, so no further
          // multiplication happens here.
          for (const addOn of line.addOns || []) {
            const addOnQty = Number(addOn.quantity ?? 1);
            if (addOnQty <= 0) continue;
            await ProductAddOn.update(
              { stock: sequelize.literal(`stock - ${addOnQty}`) },
              { where: { id: addOn.addOnId }, transaction: tx }
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
  // — name/price are then always taken from the ProductAddOn row itself, never
  // from the request, so a charge can't silently diverge from the catalog price.
  // amount = addOn.price * quantity. Only checks ownership + isActive here; the
  // stock check + decrement happens later, inside the transaction, right before
  // each charge is created (see addCharge) — doing it here would let two entries
  // for the same addOnId in one `addOns` array both pass against stale stock.
  async _resolveChargeAddOn(shopOrder, addOnId, quantity) {
    const addOn = await ProductAddOn.findByPk(addOnId);
    if (!addOn) throw clientError("Add-on not found.", 404, "NOT_FOUND");

    const items = shopOrder.items || (await this.repo.findShopOrder(shopOrder.id)).items;
    const belongsToOrder = items.some((item) =>
      addOn.variationId ? item.variationId === addOn.variationId : item.shopProductId === addOn.shopProductId
    );
    if (!belongsToOrder) {
      throw clientError("This add-on does not belong to any product in this order.", 422, "VALIDATION_ERROR");
    }

    if (!addOn.isActive) {
      throw clientError(`Add-on "${addOn.name}" is not currently available.`, 400, "ADDON_INACTIVE");
    }

    return { name: addOn.name, amount: round2(Number(addOn.price) * quantity) };
  }

  // status is computed, never stored — mirrors ShopProductService.addOnEffectiveStatus.
  _addOnEffectiveStatus(addOn) {
    if (!addOn.isActive) return "inactive";
    return Number(addOn.stock) <= 0 ? "out_of_stock" : "in_stock";
  }

  // Either `addOns` (array of {addOnId, quantity}) OR the freeform name/description/amount
  // trio must be given — never both. addOns creates one charge row per entry, each priced
  // from the catalog (addOn.price * quantity) and validated independently; a failure on
  // any entry rolls back the whole batch. The freeform path is unchanged: exactly one
  // custom charge (e.g. "Shipping fee") per call.
  async addCharge(actorUserId, shopOrderId, { name, description, amount, addOnId, quantity, addOns }) {
    const shopOrder = await this.repo.findShopOrderForOwnerCheck(shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");

    await this._assertOwnerOrAdmin(shopOrder, actorUserId);

    if (TERMINAL_STATUSES.includes(shopOrder.status)) {
      throw clientError(`Cannot add a charge to a ${shopOrder.status} order.`, 409, "INVALID_STATE");
    }

    // Normalize to a single list of "plans" to create, regardless of which input shape
    // was used, so the DB work below (transaction + total increment) is written once.
    let plans;

    const hasAddOnsArray = Array.isArray(addOns) && addOns.length > 0;
    const hasSingleAddOnId = addOnId !== undefined && addOnId !== null && addOnId !== "";

    if (hasAddOnsArray) {
      plans = [];
      for (const entry of addOns) {
        const entryAddOnId = entry?.addOnId;
        if (entryAddOnId === undefined || entryAddOnId === null || entryAddOnId === "" || !Number.isFinite(Number(entryAddOnId))) {
          throw clientError("Each entry in addOns must have a valid addOnId.", 422, "VALIDATION_ERROR");
        }
        const entryQuantity = entry?.quantity === undefined || entry?.quantity === null || entry?.quantity === "" ? 1 : Number(entry.quantity);
        if (!Number.isInteger(entryQuantity) || entryQuantity < 1) {
          throw clientError("Each entry in addOns must have an integer quantity >= 1.", 422, "VALIDATION_ERROR");
        }

        const resolved = await this._resolveChargeAddOn(shopOrder, Number(entryAddOnId), entryQuantity);
        plans.push({
          addOnId: Number(entryAddOnId),
          name: resolved.name,
          description: null,
          amount: resolved.amount,
          quantity: entryQuantity,
        });
      }
    } else if (hasSingleAddOnId) {
      const chargeQuantity = quantity === undefined || quantity === null || quantity === "" ? 1 : Number(quantity);
      if (!Number.isInteger(chargeQuantity) || chargeQuantity < 1) {
        throw clientError("quantity must be an integer >= 1.", 422, "VALIDATION_ERROR");
      }

      const resolved = await this._resolveChargeAddOn(shopOrder, Number(addOnId), chargeQuantity);
      plans = [{
        addOnId: Number(addOnId),
        name: resolved.name,
        description: null,
        amount: resolved.amount,
        quantity: chargeQuantity,
      }];
    } else {
      if (!name || !String(name).trim()) {
        throw clientError("Charge name is required.", 422, "VALIDATION_ERROR");
      }
      const amt = Number(amount);
      if (Number.isNaN(amt) || amt <= 0) {
        throw clientError("Charge amount must be a number greater than 0.", 422, "VALIDATION_ERROR");
      }
      plans = [{
        addOnId: null,
        name: String(name).trim(),
        description: description != null ? String(description).trim() : null,
        amount: amt,
        quantity: 1,
      }];
    }

    const tx = await sequelize.transaction();
    try {
      const charges = [];
      let totalChargeAmount = 0;

      for (const plan of plans) {
        // Row-locked re-check + decrement, one add-on at a time, inside the same
        // transaction — guards against two entries for the same addOnId in one
        // `addOns` array both passing against stock read before either decremented,
        // and against a concurrent request racing the same add-on.
        let updatedAddOn = null;
        if (plan.addOnId) {
          const addOn = await ProductAddOn.findByPk(plan.addOnId, { transaction: tx, lock: tx.LOCK.UPDATE });
          if (!addOn) throw clientError("Add-on not found.", 404, "NOT_FOUND");
          if (addOn.stock <= 0) {
            throw clientError(`Add-on "${addOn.name}" is out of stock.`, 400, "ADDON_OUT_OF_STOCK");
          }
          if (plan.quantity > addOn.stock) {
            throw clientError(`Only ${addOn.stock} unit(s) of add-on "${addOn.name}" available.`, 400, "ADDON_INSUFFICIENT_STOCK");
          }
          await addOn.update({ stock: addOn.stock - plan.quantity }, { transaction: tx });
          updatedAddOn = addOn;
        }

        const charge = await this.repo.createCharge(
          {
            shopOrderId,
            addOnId: plan.addOnId,
            name: plan.name,
            description: plan.description,
            amount: plan.amount,
            quantity: plan.quantity,
            addedBy: actorUserId,
            isPaid: false,
          },
          tx
        );

        charges.push({
          ...charge.toJSON(),
          addOnStock: updatedAddOn ? updatedAddOn.stock : null,
          addOnEffectiveStatus: updatedAddOn ? this._addOnEffectiveStatus(updatedAddOn) : null,
        });
        totalChargeAmount = round2(totalChargeAmount + plan.amount);
      }

      await this.repo.incrementShopOrderTotals(
        shopOrderId,
        { chargesAmount: totalChargeAmount, totalAmount: totalChargeAmount },
        tx
      );

      await tx.commit();
      return hasAddOnsArray ? charges : charges[0];
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

  // Buyer pays down the shop-order's outstanding balance directly (totalAmount -
  // paidAmount), independent of any specific charge. Mirrors OrderCartService.topUpOrder.
  async topUpShopOrder(userId, shopOrderId, amount, walletId, payFullBalance = false) {
    const shopOrder = await this.repo.findShopOrderForOwnerCheck(shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");
    if (shopOrder.userId !== userId) throw clientError("Forbidden.", 403, "UNAUTHORIZED");
    // delivered is terminal but still payable (trailing charges); only block
    // cancelled/refunded/returned.
    if (REFUNDING_STATUSES.includes(shopOrder.status)) {
      throw clientError(`Cannot pay against a ${shopOrder.status} order.`, 409, "INVALID_STATE");
    }

    const balanceDue = Math.max(0, round2(shopOrder.totalAmount) - round2(shopOrder.paidAmount));

    let parsedAmount;
    if (payFullBalance) {
      if (balanceDue <= 0) throw clientError("Order has no outstanding balance to pay.", 409, "NOTHING_DUE");
      parsedAmount = balanceDue;
    } else {
      parsedAmount = parseFloat(amount);
      if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        throw clientError("amount must be a number greater than 0.", 400, "VALIDATION_ERROR");
      }
    }

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
        `This order's payout wallet currency (${payoutWallet.currency}) does not match your wallet currency (${buyerWallet.currency}).`,
        402,
        "CURRENCY_MISMATCH"
      );
    }

    const buyerBalance = parseFloat(buyerWallet.availableBalance);
    if (buyerBalance < parsedAmount) {
      const err = clientError("Insufficient wallet balance.", 402, "INSUFFICIENT_BALANCE");
      err.data = { required: parsedAmount, available: buyerBalance };
      throw err;
    }

    const tx = await sequelize.transaction();
    try {
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance - ${parsedAmount}`) },
        { where: { id: buyerWallet.id }, transaction: tx }
      );
      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance + ${parsedAmount}`) },
        { where: { id: payoutWallet.id }, transaction: tx }
      );

      const txnRecord = await WalletTransaction.create(
        {
          walletId: buyerWallet.id,
          userId,
          receiverId: null,
          type: "TRANSFER",
          amount: parsedAmount,
          currency: buyerWallet.currency,
          description: `Additional payment for shop order #${shopOrder.orderNo}`,
          referenceType: "PRODUCT_SHOP_ORDER",
          referenceId: shopOrder.id,
          orderId: shopOrder.parentOrderId,
          performedBy: userId,
        },
        { transaction: tx }
      );

      await this.repo.incrementShopOrderTotals(shopOrder.id, { paidAmount: parsedAmount }, tx);

      await tx.commit();

      const remainingBalance = Math.max(0, round2(balanceDue - parsedAmount));

      return {
        shopOrderId: shopOrder.id,
        amountPaid: parsedAmount,
        remainingBalance,
        fullyPaid: remainingBalance <= 0,
        paymentDetails: {
          buyerWallet: { id: buyerWallet.id, deducted: parsedAmount },
          payoutWallet: { id: payoutWallet.id, credited: parsedAmount },
          transactionId: txnRecord.id,
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

  // Admin/accountant records a payment received outside the platform (cash, bank
  // transfer, etc.) against a shop-order. No buyer wallet is debited; the shop's
  // payout wallet is credited for real since the money never moved through the
  // platform otherwise. Mirrors OrderCartService.adminRecordPayment (minus the
  // ledger row, since ProductShopOrder has no OrderPayment-equivalent table).
  async adminRecordShopOrderPayment(adminUserId, shopOrderId, amount, note) {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw clientError("amount must be a number greater than 0.", 400, "VALIDATION_ERROR");
    }

    const shopOrder = await this.repo.findShopOrderForOwnerCheck(shopOrderId);
    if (!shopOrder) throw clientError("Order not found.", 404, "NOT_FOUND");

    const payoutWallet = await this.repo.fetchWalletById(shopOrder.payoutWalletId);
    if (!payoutWallet) {
      throw clientError("This shop's payout wallet is no longer available.", 500, "NO_PAYOUT_WALLET");
    }

    const shop = await this.repo.fetchShop(shopOrder.shopId);
    const shopOwnerId = shop ? shop.userId : payoutWallet.userId;

    const tx = await sequelize.transaction();
    try {
      await this.repo.incrementShopOrderTotals(shopOrder.id, { paidAmount: parsedAmount }, tx);

      await Wallet.update(
        { availableBalance: sequelize.literal(`availableBalance + ${parsedAmount}`) },
        { where: { id: payoutWallet.id }, transaction: tx }
      );

      const txnRecord = await WalletTransaction.create(
        {
          walletId: payoutWallet.id,
          userId: shopOwnerId,
          receiverId: null,
          type: "DEPOSIT",
          amount: parsedAmount,
          currency: payoutWallet.currency,
          description: `Admin-recorded payment for shop order #${shopOrder.orderNo}`,
          referenceType: "PRODUCT_SHOP_ORDER",
          referenceId: shopOrder.id,
          orderId: shopOrder.parentOrderId,
          performedBy: adminUserId,
        },
        { transaction: tx }
      );

      await tx.commit();

      await notificationService.notifyUser({
        userId: shopOrder.userId,
        actorId: adminUserId,
        type: "PRODUCT_ORDER_PAYMENT_RECORDED",
        title: "Payment Recorded",
        message: `Admin recorded a payment of ${round2(parsedAmount)} on your order #${shopOrder.orderNo}.${note ? ` Note: ${note}` : ""}`,
        entityType: "PRODUCT_SHOP_ORDER",
        entityId: shopOrder.id,
        data: { amount: round2(parsedAmount), note: note || null },
      });

      return {
        shopOrderId: shopOrder.id,
        amount: parsedAmount,
        note: note || null,
        createdBy: adminUserId,
        transactionId: txnRecord.id,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      await tx.rollback();
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
