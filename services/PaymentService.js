const { Op } = require("sequelize");
const sequelize = require("../config/database");
const PaymentRepository = require("../repositories/PaymentRepository");
const PaymentRequest = require("../models/payment_request");
const { Transaction, PaymentType, Income, Expense } = require("../models");
const User = require("../models/user");
const Role = require("../models/role");
const CurrencyService = require("./CurrencyService");
const { PaymentTypes } = require("../constants");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");

const currencyService = new CurrencyService();
const WalletService = require("./WalletService");
const walletService = new WalletService();
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();
const Wallet = require("../models/wallet");

class PaymentService {
  constructor() {
    this.paymentRepository = new PaymentRepository();
  }

  // Create a Stripe customer when user registers
  async createStripeCustomer(user, email) {
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: user.id, // Link to your internal user ID
      },
    });

    // Save stripeCustomerId to your user in database
    const updatedUser = await walletService.updateCustomerId(user, customer.id);
    return updatedUser;
  }

  async createPayment(paymentData) {
    // Perform any necessary validation or business logic checks here
    // Example: Check if the account type is valid, validate the payment amount, etc.

    return this.paymentRepository.createPayment(paymentData);
  }

  async updatePayment(paymentId, updatedPaymentData) {
    // Add any additional business logic or validation before updating the payment
    return this.paymentRepository.update(paymentId, updatedPaymentData);
  }

  /**
   * Convert from one currency wallet to another (e.g. EUR → CNY).
   * @param {number} userId
   * @param {number} amount - amount in fromCurrency to deduct (e.g. 10 EUR)
   * @param {number} currentRate - rate; target amount = amount / currentRate (e.g. 10/2 = 5 CNY)
   * @param {string} fromCurrency - e.g. "EUR"
   * @param {string} toCurrency - e.g. "CNY"
   */
  async transferAmount(
    userId,
    amount,
    type,
    currentRate,
    fromCurrency = "USD",
    toCurrency = "CNY",
    description = null,
  ) {
    // The mobile "Convert" screen sends `amount` as the TARGET-currency value
    // shown in the "To" field (source amount × rate), not the source amount
    // the user typed. Derive the equivalent source-currency amount here so
    // fxConvert's sufficiency check runs against the correct wallet, and its
    // internal multiply reproduces this exact target amount on credit.
    const rate = Number(currentRate);
    const sourceAmount = Number(amount) / rate;

    return walletService.fxConvert({
      userId,
      fromCurrency,
      toCurrency,
      description,
      amountInSource: sourceAmount,
      rate,
      walletType: type,
      meta: { source: "payment_convert", requestedTargetAmount: Number(amount) },
    });
  }

  async deletePayment(paymentId) {
    // Add any additional business logic or validation before deleting the payment
    return this.paymentRepository.delete(paymentId);
  }

  async cancelPaymentRelation(userId) {
    // 1. Find all payment relations for this user
    const relations = await PaymentRequest.findAll({
      where: {
        [Op.or]: [{ requesterId: userId }, { requesteeId: userId }],
      },
    });

    // 2. If none found, just return []
    if (!relations || relations.length === 0) {
      return [];
    }

    // 3. Delete all found relations
    await PaymentRequest.destroy({
      where: {
        [Op.or]: [{ requesterId: userId }, { requesteeId: userId }],
      },
    });

    return relations;
  }

  async getUserPayments(userId) {
    // Add any additional business logic or validation before retrieving user payments
    return this.paymentRepository.getByUserId(userId);
  }

  async getPaymentById(paymentId) {
    return this.paymentRepository.getById(paymentId);
  }

  async getUserCards(userId) {
    return this.paymentRepository.getCardsByUser(userId);
  }

  async getCardCompanyAddresses(userId) {
    return this.paymentRepository.getCompanyAddressByUser(userId);
  }

  async addCard(cardData) {
    if (cardData.addressId) {
      const addresses = await this.paymentRepository.getCompanyAddressByUser(cardData.userId);
      const valid = addresses.some((a) => a.id === cardData.addressId);
      if (!valid) {
        throw new Error("Address not found or is not a company type address");
      }
    }
    return this.paymentRepository.addCard(cardData);
  }

  async updateCard(cardId, userId, cardData) {
    const card = await this.paymentRepository.getCardById(cardId);
    if (!card) throw new Error("Card not found");
    if (card.userId !== userId) throw new Error("Unauthorized");

    if (cardData.addressId) {
      const addresses = await this.paymentRepository.getCompanyAddressByUser(userId);
      const valid = addresses.some((a) => a.id === cardData.addressId);
      if (!valid) {
        throw new Error("Address not found or is not a company type address");
      }
    }
    return this.paymentRepository.updateCard(cardId, cardData);
  }

  async deleteCard(cardId) {
    return this.paymentRepository.deleteCard(cardId);
  }

  async favouritePayment(paymentId, userId) {
    // Add any additional business logic or validation before favouriting the payment
    return this.paymentRepository.favouritePayment(paymentId, userId);
  }

  async unfavouritePayment(paymentId, userId) {
    // Add any additional business logic or validation before unfavouriting the payment
    return this.paymentRepository.unfavouritePayment(paymentId, userId);
  }

  async processTopupPayment(
    userId,
    amount,
    walletType,
    description,
    paymentCurrency,
  ) {
    if (!amount || isNaN(amount) || amount <= 0) {
      const err = new Error("Amount must be a positive number");
      err.statusCode = 400;
      err.isUserError = true;
      throw err;
    }

    // Step 1: Validate wallet exists
    // const wallet = await walletService.getWallet(userId, paymentCurrency, walletType);
    // if (!wallet) {
    //   const err = new Error(`Wallet not found for ${paymentCurrency} ${walletType}`);
    //   err.statusCode = 400;
    //   err.isUserError = true;
    //   throw err;
    // }

    // Step 2: Get FX rate (wallet currency → USD)
    let rate;
    try {
      if (paymentCurrency === "USD") {
        rate = 1;
      } else {
        const rateData = await currencyService.getAdjustedRate(
          paymentCurrency,
          "USD",
        );
        console.log("FX rate data:", paymentCurrency, rateData);
        if (!rateData?.finalRate) throw new Error("No rate returned");
        rate = parseFloat(rateData.finalRate);
      }
    } catch (e) {
      const err = new Error(`FX rate unavailable for ${paymentCurrency} → USD`);
      err.statusCode = 500;
      throw err;
    }
    console.log(`FX rate for ${paymentCurrency} → USD:`, rate);

    const usdAmount = amount / rate;
 
    console.log(`Converted amount: ${amount} ${paymentCurrency} → ${usdAmount} USD`);
    const stripeAmount = Math.round(usdAmount * 100);
    console.log(`Stripe amount: ${stripeAmount} cents`);

    // Step 4: Create pending Transaction
    const orderId = `topup_${Date.now()}_${userId}`;
    const paidAmount = parseFloat((stripeAmount / 100).toFixed(8));

    await Transaction.create({
      orderId,
      userId,
      amount: parseFloat(String(amount)),
      paidAmount,
      paidCurrency: "USD",
      currency: paymentCurrency,
      rate,
      type: "wallet_topup",
      status: "pending",
      paymentMethod: "card",
      metadata: {
        walletType,
        paymentCurrency,
        originalAmount: amount,
        fxRate: rate,
      },
    });

    // Step 5: Create Stripe Checkout Session
    const user = await walletService.getUserWalletById(userId);
    const baseUrl = process.env.baseUrl;
    console.log("Processing top-up payment:", baseUrl);

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Wallet Top-up (${paymentCurrency})`,
                description:
                  description ||
                  `Top up ${amount} ${paymentCurrency} to ${walletType} wallet`,
              },
              unit_amount: stripeAmount,
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId: String(user.id),
          orderId,
          purpose: "wallet_topup",
          walletType,
          walletCurrency: paymentCurrency,
          originalAmount: String(amount),
          fxRate: String(rate),
        },
        success_url: `${baseUrl}/wallet/topup-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/wallet/topup-cancelled`,
      });
    } catch (e) {
      console.error("❌ Stripe session creation failed:", e);
      const err = new Error("Payment provider error: " + e.message);
      err.statusCode = 500;
      throw err;
    }

    // Update transaction with stripe session id
    await Transaction.update(
      {
        metadata: {
          walletType,
          paymentCurrency,
          originalAmount: amount,
          fxRate: rate,
          stripeSessionId: session.id,
        },
      },
      { where: { orderId } },
    );

    return {
      checkoutUrl: session.url,
      checkoutSessionId: session.id,
      amount,
      paymentCurrency,
    };
  }

  async getUserTopupTransactions(userId) {
    console.log("Fetching top-up transactions for user:", userId);
    return await Transaction.findAll({
      where: { userId, type: "wallet_topup" },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "username",
            "firstname",
            "lastname",
            "profilePic",
            "description",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async handlePaymentCheckoutSucceeded(session) {
    console.log("✅ Checkout session completed:", session.id);

    const { metadata, amount_total, id: sessionId } = session;

    if (!metadata || metadata.purpose !== "wallet_topup") {
      console.warn("Skipping non-wallet top-up session:", sessionId);
      return;
    }

    // Step 1: Extract metadata
    const {
      userId: rawUserId,
      walletType,
      walletCurrency,
      fxRate,
      originalAmount,
      orderId,
    } = metadata;

    if (
      !rawUserId ||
      isNaN(rawUserId) ||
      !walletType ||
      !walletCurrency ||
      !fxRate ||
      !originalAmount ||
      !orderId
    ) {
      const err = new Error(
        "Missing required metadata fields in webhook session.",
      );
      err.isUserError = true;
      throw err;
    }

    try {
      await this.finalizeWalletTopup({
        orderId,
        userId: parseInt(rawUserId),
        walletType,
        walletCurrency,
        rate: Number(fxRate),
        origAmount: Number(originalAmount),
        usdAmount: amount_total / 100,
        sessionId,
        stripeEvent: "checkout.session.completed",
      });
    } catch (err) {
      console.error("❌ Payment processing failed:", err);
      throw err;
    }
  }

  // Shared "complete the top-up" step used by both the Stripe Checkout
  // webhook and the Google Pay (PaymentIntent) flow, so a top-up is only
  // ever credited to the wallet through this one code path.
  // Idempotent on orderId: safe to call more than once for the same order
  // (webhook redelivery, retried Google Pay request, etc.).
  async finalizeWalletTopup({
    orderId,
    userId,
    walletType,
    walletCurrency,
    rate,
    origAmount,
    usdAmount,
    sessionId,
    stripeEvent,
  }) {
    const existing = await Transaction.findOne({ where: { orderId } });
    if (!existing) {
      console.warn(
        `⚠️ Transaction not found for orderId: ${orderId}; may have been created outside normal flow`,
      );
    } else if (existing.status === "completed") {
      console.log(`ℹ️ Duplicate finalize ignored for orderId: ${orderId}`);
      return existing;
    }

    const creditedAmount = usdAmount * rate;

    await walletService.deposit({
      userId,
      currency: walletCurrency,
      walletType,
      amount: creditedAmount,
      description: `Stripe Wallet Top-up via session ${sessionId}`,
      meta: {
        stripeSessionId: sessionId,
        stripeOrderId: orderId,
        paidAmount: usdAmount,
        paidCurrency: "USD",
        rate,
        originalAmount: origAmount,
      },
    });

    if (existing) {
      await existing.update({
        status: "completed",
        paidAmount: usdAmount,
        paidCurrency: "USD",
        metadata: {
          ...existing.metadata,
          stripeSessionId: sessionId,
          stripeEvent,
          creditedAmount,
        },
      });
    }

    console.log(
      `💰 Wallet top-up: ${origAmount} ${walletCurrency} (${usdAmount} USD) → ${walletType} wallet (userId: ${userId})`,
    );

    return existing;
  }

  async processGooglePayTopup(
    userId,
    amount,
    walletType,
    description,
    paymentCurrency,
    paymentToken,
  ) {
    if (!amount || isNaN(amount) || amount <= 0) {
      const err = new Error("Amount must be a positive number");
      err.statusCode = 400;
      err.isUserError = true;
      throw err;
    }

    // Step 2: Get FX rate (wallet currency → USD) — identical to processTopupPayment
    let rate;
    try {
      if (paymentCurrency === "USD") {
        rate = 1;
      } else {
        const rateData = await currencyService.getAdjustedRate(
          paymentCurrency,
          "USD",
        );
        if (!rateData?.finalRate) throw new Error("No rate returned");
        rate = parseFloat(rateData.finalRate);
      }
    } catch (e) {
      const err = new Error(`FX rate unavailable for ${paymentCurrency} → USD`);
      err.statusCode = 500;
      throw err;
    }

    const usdAmount = amount / rate;
    const stripeAmount = Math.round(usdAmount * 100);

    // Step 4: Create pending Transaction
    const orderId = `topup_${Date.now()}_${userId}`;
    const paidAmount = parseFloat((stripeAmount / 100).toFixed(8));

    await Transaction.create({
      orderId,
      userId,
      amount: parseFloat(String(amount)),
      paidAmount,
      paidCurrency: "USD",
      currency: paymentCurrency,
      rate,
      type: "wallet_topup",
      status: "pending",
      paymentMethod: "google_pay",
      metadata: {
        walletType,
        paymentCurrency,
        originalAmount: amount,
        fxRate: rate,
      },
    });

    // Step 5: charge the Google Pay token directly via a PaymentIntent
    let stripeTokenId;
    try {
      stripeTokenId = JSON.parse(paymentToken).id;
    } catch (_) {
      stripeTokenId = paymentToken; // already an id
    }

    let intent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: stripeAmount,
          currency: "usd",
          payment_method_data: { type: "card", card: { token: stripeTokenId } },
          confirm: true,
          description:
            description ||
            `Top up ${amount} ${paymentCurrency} to ${walletType} wallet`,
          metadata: {
            userId: String(userId),
            orderId,
            purpose: "wallet_topup",
            walletType,
            walletCurrency: paymentCurrency,
            originalAmount: String(amount),
            fxRate: String(rate),
          },
          automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        },
        { idempotencyKey: `gpay_topup_${orderId}` },
      );
    } catch (e) {
      await Transaction.update(
        { status: "failed" },
        { where: { orderId } },
      );
      // StripeInvalidRequestError (e.g. bad/expired token) and StripeCardError
      // (e.g. declined) are routine rejections, not server outages — surface
      // them as 400 so monitoring/alerting doesn't flag them as 5xx errors.
      const isClientRejection =
        e.type === "StripeInvalidRequestError" || e.type === "StripeCardError";
      const err = new Error("Payment provider error: " + e.message);
      err.statusCode = isClientRejection ? 400 : 500;
      err.isUserError = isClientRejection;
      throw err;
    }

    if (intent.status !== "succeeded") {
      // No redirect capability in this mobile token flow — a requires_action
      // (3DS challenge) result is treated as a failure for v1.
      await Transaction.update(
        { status: "failed", metadata: { walletType, paymentCurrency, originalAmount: amount, fxRate: rate, stripePaymentIntentId: intent.id, stripeStatus: intent.status } },
        { where: { orderId } },
      );
      const err = new Error(
        intent.status === "requires_action"
          ? "Additional verification required — please use another payment method"
          : `Payment ${intent.status}`,
      );
      err.statusCode = 402;
      err.isUserError = true;
      throw err;
    }

    // Step 6: finalize exactly like the Checkout webhook does
    await this.finalizeWalletTopup({
      orderId,
      userId,
      walletType,
      walletCurrency: paymentCurrency,
      rate,
      origAmount: amount,
      usdAmount,
      sessionId: intent.id,
      stripeEvent: "payment_intent.succeeded.google_pay",
    });

    return { amount, paymentCurrency, paymentIntentId: intent.id };
  }

  async handlePaymentIntentSucceeded(paymentIntent) {
    console.log("✅ PaymentIntent succeeded:", paymentIntent.id);
    // checkout.session.completed is the authoritative event for wallet top-ups;
    // this handler records the succeeded state on any matching pending transaction.
    const orderId = `topup_${paymentIntent.id.slice(-8)}`;
    const existing = await Transaction.findOne({ where: { orderId } });
    if (existing && existing.status !== "completed") {
      await existing.update({ status: "completed" });
      console.log(
        `💳 Transaction ${orderId} marked completed via payment_intent.succeeded`,
      );
    }
  }

  async handleChargeUpdated(charge) {
    console.log("🔄 Charge updated:", charge.id, "status:", charge.status);
    // Reflect charge status changes (e.g. refunded, disputed) on the transaction record.
    const paymentIntentId = charge.payment_intent;
    if (!paymentIntentId) return;

    const orderId = `topup_${paymentIntentId.slice(-8)}`;
    const existing = await Transaction.findOne({ where: { orderId } });
    if (!existing) return;

    const updates = {};
    if (charge.refunded) updates.status = "refunded";
    else if (charge.disputed) updates.status = "disputed";
    else if (charge.status === "failed") updates.status = "failed";

    if (Object.keys(updates).length > 0) {
      await existing.update(updates);
      console.log(
        `🔄 Transaction ${orderId} updated to status: ${updates.status}`,
      );
    }
  }

  async handleCheckoutSessionCanceled(session) {
    console.log("⚠️ Checkout session canceled:", session.id);
    // You may optionally log or persist the cancellation here.
  }

  async handlePaymentIntentCanceled(paymentIntent) {
    console.log("⚠️ PaymentIntent canceled:", paymentIntent.id);
    // You may optionally log or persist the cancellation here.
  }
  // ------------------- LEDGER -------------------

  async bulkCreateLedgers({ ledgers, userId }) {
    const transaction = await sequelize.transaction();
    try {
      const allPaymentTypeIds = [
        ...ledgers.flatMap((l) => l.incomes?.map((i) => i.paymentTypeId) || []),
        ...ledgers.flatMap(
          (l) => l.expenses?.map((e) => e.paymentTypeId) || [],
        ),
      ];

      const uniqueIds = [...new Set(allPaymentTypeIds)];
      const validIds =
        await this.paymentRepository.findExistingPaymentTypeIds(uniqueIds);
      const invalidIds = uniqueIds.filter((id) => !validIds.includes(id));

      if (invalidIds.length > 0) {
        throw new Error(`Invalid paymentTypeId(s): ${invalidIds.join(", ")}`);
      }

      const results = [];

      // Iterate over each ledger to create it along with associated incomes and expenses
      for (const {
        title,
        description,
        addNote,
        customerNote,
        incomes = [],
        expenses = [],
      } of ledgers) {
        // Create Ledger
        const ledger = await this.paymentRepository.addLedger(
          { title, description, addNote, customerNote, userId },
          { transaction },
        );

        // If there are incomes to be added
        if (incomes.length > 0) {
          // Get the current max sequence of incomes for this ledger
          const maxIncomeSequence =
            (await Income.max("sequence", {
              where: { ledgerId: ledger.id },
              transaction,
            })) || 0; // Default to 0 if no income entries exist

          // Assign sequence to incomes
          const incomesWithSequence = incomes.map((i, index) => ({
            ...i,
            ledgerId: ledger.id,
            sequence: maxIncomeSequence + index + 1, // Increment the sequence for each new income
          }));
          console.log("incomesWithSequence", incomesWithSequence);

          // Bulk create incomes
          await this.paymentRepository.bulkCreateIncome(incomesWithSequence, {
            transaction,
          });
        }

        // If there are expenses to be added
        if (expenses.length > 0) {
          // Get the current max sequence of expenses for this ledger
          const maxExpenseSequence =
            (await Expense.max("sequence", {
              where: { ledgerId: ledger.id },
              transaction,
            })) || 0; // Default to 0 if no expense entries exist

          // Assign sequence to expenses
          const expensesWithSequence = expenses.map((e, index) => ({
            ...e,
            ledgerId: ledger.id,
            sequence: maxExpenseSequence + index + 1, // Increment the sequence for each new expense
          }));
          console.log("expensesWithSequence", expensesWithSequence);

          // Bulk create expenses
          await this.paymentRepository.bulkCreateExpense(expensesWithSequence, {
            transaction,
          });
        }

        // Add the ledger to the results
        results.push(ledger);
      }

      // Commit the transaction if everything goes well
      await transaction.commit();
      return results;
    } catch (error) {
      // If any error occurs, rollback the transaction
      await transaction.rollback();
      throw error;
    }
  }

  async addLedger(data) {
    return this.paymentRepository.addLedger(data);
  }

  async getUserLedgers(userId, archived = true) {
    const ledgers = await this.paymentRepository.getLedgersByUser(
      userId,
      archived,
    );
    if (!ledgers || ledgers.length === 0)
      return {
        ledgers: [],
        summary: {
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
        },
      };

    let overallIncome = 0;
    let overallExpense = 0;

    const formattedLedgers = ledgers.map((ledger) => {
      const incomes = ledger.incomes || [];
      const expenses = ledger.expenses || [];

      const totalIncome = incomes.reduce(
        (sum, inc) => sum + parseFloat(inc.amount || 0),
        0,
      );
      const totalExpense = expenses.reduce(
        (sum, exp) => sum + parseFloat(exp.amount || 0),
        0,
      );
      const balance = totalIncome - totalExpense;

      overallIncome += totalIncome;
      overallExpense += totalExpense;

      return {
        ...ledger.toJSON(),
        totalIncome,
        totalExpense,
        balance,
      };
    });

    const overallBalance = overallIncome - overallExpense;

    return {
      ledgers: formattedLedgers || [],
      summary: {
        totalIncome: overallIncome || 0,
        totalExpense: overallExpense || 0,
        balance: overallBalance || 0,
      },
    };
  }

  async getLedgerById(id) {
    const ledger = await this.paymentRepository.getLedgerById(id);
    if (!ledger) return null;

    const totalIncome =
      ledger.incomes?.reduce(
        (sum, inc) => sum + parseFloat(inc.amount || 0),
        0,
      ) || 0;
    const totalExpense =
      ledger.expenses?.reduce(
        (sum, exp) => sum + parseFloat(exp.amount || 0),
        0,
      ) || 0;
    const balance = totalIncome - totalExpense;

    return {
      ...ledger.toJSON(),
      totalIncome,
      totalExpense,
      balance,
    };
  }

  async updateLedger(id, data) {
    return this.paymentRepository.updateLedger(id, data);
  }

  async reorderLedger(userId, ledgerId, newPosition) {
    return this.paymentRepository.reorderLedger(userId, ledgerId, newPosition);
  }

  async duplicateLedger(originalLedgerId, userId) {
    const original =
      await this.paymentRepository.getLedgerWithTransactions(originalLedgerId);
    if (!original) throw new Error("Ledger not found");

    // Create new ledger with "(Copy)" in title
    const newLedger = await this.paymentRepository.createLedger({
      title: original.title + " (Copy)",
      description: original.description,
      userId,
    });

    // Duplicate incomes
    if (original.incomes?.length) {
      const newIncomes = original.incomes.map((inc) => ({
        amount: inc.amount,
        description: inc.description,
        ledgerId: newLedger.id,
        paymentTypeId: inc.paymentTypeId,
      }));
      await this.paymentRepository.bulkCreateIncome(newIncomes);
    }

    // Duplicate expenses
    if (original.expenses?.length) {
      const newExpenses = original.expenses.map((exp) => ({
        amount: exp.amount,
        description: exp.description,
        ledgerId: newLedger.id,
        paymentTypeId: exp.paymentTypeId,
      }));
      await this.paymentRepository.bulkCreateExpense(newExpenses);
    }

    return this.paymentRepository.getLedgerById(newLedger.id);
  }

  async archiveLedger(ledgerId, userId, archived) {
    return this.paymentRepository.updateLedger(
      { id: ledgerId, userId },
      { archived },
    );
  }

  async deleteLedger(id) {
    return this.paymentRepository.deleteLedger(id);
  }

  async addBulkLedgerTransactions({
    ledgerId,
    incomes = [],
    expenses = [],
    userId,
  }) {
    const ledger = await this.paymentRepository.getLedgerById(ledgerId);
    if (!ledger) throw new Error("Ledger not found");

    const paymentTypeIds = [
      ...incomes.map((i) => i.paymentTypeId),
      ...expenses.map((e) => e.paymentTypeId),
    ].filter(Boolean);

    console.log(paymentTypeIds);
    const validIds =
      await this.paymentRepository.findExistingPaymentTypeIds(paymentTypeIds);
    const invalidIds = paymentTypeIds.filter((id) => !validIds.includes(id));
    if (invalidIds.length > 0) {
      throw new Error(`Invalid paymentTypeId(s): ${invalidIds.join(", ")}`);
    }

    const transaction = await sequelize.transaction();
    try {
      if (incomes.length > 0) {
        const incomeData = incomes.map((i) => ({ ...i, ledgerId }));
        await this.paymentRepository.bulkCreateIncome(incomeData, {
          transaction,
        });
      }

      if (expenses.length > 0) {
        const expenseData = expenses.map((e) => ({ ...e, ledgerId }));
        await this.paymentRepository.bulkCreateExpense(expenseData, {
          transaction,
        });
      }

      await transaction.commit();
      return {
        ledgerId,
        incomeCount: incomes.length,
        expenseCount: expenses.length,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ------------------- INCOME -------------------
  async addIncomeQRM(data) {
    const { paymentTypeId, ledgerId } = data;
    const ledger = await this.paymentRepository.getLedgerById(ledgerId);

    console.log("ledger", ledger);
    if (!ledger) throw new Error("Invalid ledgerId: not found");

    const paymentType =
      await this.paymentRepository.getPaymentTypeById(paymentTypeId);
    console.log("paymentType", paymentType);
    if (!paymentType) throw new Error("Invalid paymentTypeId: not found");

    return this.paymentRepository.addIncomeQRM(data);
  }

  async getIncomeById(id) {
    const income = await this.paymentRepository.getIncomeById(id);
    if (!income) throw new Error("Income not found");
    return income;
  }

  async updateIncome(id, data) {
    if (data.paymentTypeId) {
      const pt = await this.paymentRepository.getPaymentTypeById(
        data.paymentTypeId,
      );
      if (!pt) throw new Error("Invalid paymentTypeId: not found");
    }
    if (data.ledgerId) {
      const ledger = await this.paymentRepository.getLedgerById(data.ledgerId);
      if (!ledger) throw new Error("Invalid ledgerId: not found");
    }
    await this.paymentRepository.updateIncome(id, data);
    const updatedIncome = await this.paymentRepository.getIncomeById(id);
    return updatedIncome;
  }

  async deleteIncome(id) {
    const deleted = await this.paymentRepository.deleteIncome(id);
    if (deleted === 0) throw new Error("Income not found or already deleted");
    return true;
  }

  async reorderIncome(incomeId, newPosition) {
    return this.paymentRepository.reorderIncome(incomeId, newPosition);
  }

  // ------------------- EXPENSE -------------------
  async addExpenseQRM(data) {
    const { paymentTypeId, ledgerId } = data;

    const ledger = await this.paymentRepository.getLedgerById(ledgerId);
    if (!ledger) throw new Error("Invalid ledgerId: not found");

    const paymentType =
      await this.paymentRepository.getPaymentTypeById(paymentTypeId);
    if (!paymentType) throw new Error("Invalid paymentTypeId: not found");

    return this.paymentRepository.addExpenseQRM(data);
  }

  async getExpenseById(id) {
    const expense = await this.paymentRepository.getExpenseById(id);
    if (!expense) throw new Error("Expense not found");
    return expense;
  }

  async updateExpense(id, data) {
    if (data.paymentTypeId) {
      const pt = await this.paymentRepository.getPaymentTypeById(
        data.paymentTypeId,
      );
      if (!pt) throw new Error("Invalid paymentTypeId: not found");
    }
    if (data.ledgerId) {
      const ledger = await this.paymentRepository.getLedgerById(data.ledgerId);
      if (!ledger) throw new Error("Invalid ledgerId: not found");
    }
    await this.paymentRepository.updateExpense(id, data);
    return await this.paymentRepository.getExpenseById(id);
  }

  async deleteExpense(id) {
    const deleted = await this.paymentRepository.deleteExpense(id);
    if (deleted === 0) throw new Error("Expense not found or already deleted");
    return true;
  }

  async reorderExpense(expenseId, newPosition) {
    return this.paymentRepository.reorderExpense(expenseId, newPosition);
  }

  // ------------------- PAYMENT TYPE -------------------

  // utility function to  payment type
  async validatePaymentTypePin(userId) {
    const paymentType =
      await this.paymentRepository.getPaymentTypeByUserId(userId);
    if (!paymentType) throw new Error("Payment type not found");
    for (let pt of paymentType) {
      if (pt.pin) {
        return true;
      }
    }
    return false;
  }

  async createPaymentType(data) {
    const exists = await this.paymentRepository.getPaymentTypeByNameAndUser(
      data.name,
      data.userId,
    );
    if (exists)
      throw new Error(
        "Payment type with this name already exists for your account",
      );
    if (await this.validatePaymentTypePin(data.userId)) {
      data.pin = false;
      return this.paymentRepository.createPaymentType(data);
    } else {
      data.pin = true;
      return this.paymentRepository.createPaymentType(data);
    }
  }

  async getAllPaymentTypes({ search, userId }) {
    const where = { userId };
    if (search) {
      where["name"] = { [require("sequelize").Op.iLike]: `%${search}%` };
    }
    return this.paymentRepository.getAllPaymentTypes(where);
  }

  async getPaymentTypeById(id) {
    return this.paymentRepository.getDefaultPaymentTypeById(id);
  }

  async updatePaymentType(id, updateData) {
    try {
      let paymentType = await this.paymentRepository.getPaymentTypeById(id);

      if (!paymentType) {
        throw new Error("Payment type not found");
      }

      if (updateData.name) {
        if (PaymentTypes.includes(paymentType.name)) {
          throw new Error(
            "Cannot update permanent payment type this is default name",
          );
        }

        const existing = await this.paymentRepository.getPaymentTypeByName(
          updateData.name,
        );

        if (existing && existing.id !== parseInt(id)) {
          throw new Error("Payment type with this name already exists");
        }
      }

      // ✅ If pin is being set to true
      if (updateData.pin === true) {
        return await this.paymentRepository.unpinAllPaymentTypes(
          paymentType.userId,
          id, // exclude current id
        );
      }

      const updated = await this.paymentRepository.updatePaymentType(
        id,
        updateData,
      );

      return updated;
    } catch (error) {
      throw error;
    }
  }

  async deletePaymentType(id, userId) {
    const paymentType = await this.paymentRepository.getPaymentTypeById(id);

    if (!paymentType) throw new Error("Payment type not found");

    if (PaymentTypes.includes(paymentType.name)) {
      throw new Error("Cannot delete permanent payment type");
    }

    const inUse = await this.paymentRepository.isPaymentTypeInUse(id);
    if (inUse) {
      throw new Error("Cannot delete - payment type is in use");
    }
    return this.paymentRepository.deletePaymentType(id);
  }

  // Wallet-to-wallet transfer between two users (moved from ChatService).
  async sendPaymentRequest(requesterId, requesteeId, amount, currency, description) {
    const requester = await userRepository.getById(requesterId);
    const requestee = await userRepository.getById(requesteeId);
    if (!requester || !requestee) {
      throw new Error("One or both users not found");
    }

    return this.paymentRepository.createPaymentRequest(
      requesterId,
      requesteeId,
      amount,
      currency,
      description,
    );
  }

  async sendPayment(requesterId, requesteeId, amount, currency, walletType, description) {
    const user = await userRepository.getById(requesteeId);
    if (!user) {
      return { message: `User with ID ${requesteeId} not found` };
    }
    if (requesterId === requesteeId && user.roles[0].name !== "admin") {
      return {
        message: "Regular users cannot transfer balance to themselves.",
        success: false,
      };
    }

    const paymentRequest = await this.paymentRepository.createPaymentRequest(
      requesterId,
      requesteeId,
      amount,
      currency,
      description,
      "accepted",
    );

    // Now perform the balance transfer
    await this.transferBalance(requesterId, requesteeId, walletType, amount, currency, description);

    return this.paymentRepository.getTransactionById(paymentRequest.id);
  }

  async adminDecreasePayment(
    adminUserId,
    targetUserId,
    amount,
    currency,
    description,
    walletType = "PERSONAL",
  ) {
    const user = await userRepository.getById(targetUserId);
    if (!user) {
      throw new Error(`User with ID ${targetUserId} not found`);
    }

    return walletService.withdraw({
      userId: targetUserId,
      currency,
      description,
      amount,
      walletType,
      meta: {
        source: "admin_manual_decrease",
        description: description || null,
      },
      performedBy: adminUserId,
    });
  }

  async transferBalance(fromUserId, toUserId, walletType, amount, currency, description) {
    const t = await sequelize.transaction();
    try {
      const fromId = Number(fromUserId);
      const toId = Number(toUserId);
      const transferAmount = Number(amount);
      const normalizedCurrency = String(currency || "").trim().toUpperCase();

      if (!Number.isFinite(fromId) || !Number.isFinite(toId)) {
        throw new Error("Invalid sender/recipient userId");
      }
      if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
        throw new Error("Invalid transfer amount");
      }
      if (!normalizedCurrency || normalizedCurrency.length !== 3) {
        throw new Error("Invalid currency");
      }

      const senderUser = await User.findByPk(fromId, {
        include: [{ model: Role, as: "roles" }],
        transaction: t,
      });
      const senderRole = senderUser?.roles?.[0]?.name;
      const isAdmin = String(senderRole || "").toLowerCase() === "admin";
      const isSameUser = fromId === toId;

      if (isSameUser && !isAdmin) {
        throw new Error("Regular users cannot transfer balance to themselves.");
      }

      // Lock wallets in stable order to reduce deadlocks
      const firstUserId = Math.min(fromId, toId);
      const secondUserId = Math.max(fromId, toId);

      const firstWallet = await Wallet.findOne({
        where: { userId: firstUserId, currency: normalizedCurrency, walletType },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const secondWallet =
        secondUserId === firstUserId
          ? firstWallet
          : await Wallet.findOne({
              where: { userId: secondUserId, currency: normalizedCurrency, walletType },
              transaction: t,
              lock: t.LOCK.UPDATE,
            });

      const senderWallet = fromId === firstUserId ? firstWallet : secondWallet;
      const recipientWallet = toId === firstUserId ? firstWallet : secondWallet;

      if (!senderWallet || !recipientWallet) {
        throw new Error("Wallet not found for sender or recipient");
      }

      const senderAvailableBalance = Number(senderWallet.availableBalance) || 0;
      const recipientAvailableBalance = Number(recipientWallet.availableBalance) || 0;

      // Admin self transfer: credit availableBalance (no debit)
      if (isSameUser && isAdmin) {
        const after = senderAvailableBalance + transferAmount;
        const groupId = crypto.randomUUID();

        await walletService.createWalletTransaction(
          {
            transaction_group_id: groupId,
            walletId: senderWallet.id,
            userId: toId,
            type: "DEPOSIT",
            amount: transferAmount,
            currency: normalizedCurrency,
            description: description,
            receiptId: null,
            meta: {
              source: "admin_deposit_self",
              balanceBefore: senderAvailableBalance,
              balanceAfter: after,
            },
            performedBy: fromId,
          },
          t,
        );

        senderWallet.availableBalance = after;
        await senderWallet.save({ transaction: t });
        await t.commit();
        return { transaction_group_id: groupId };
      }

      if (senderAvailableBalance < transferAmount) {
        throw new Error("Insufficient balance");
      }

      const groupId = crypto.randomUUID();

      const senderAfter = senderAvailableBalance - transferAmount;
      await walletService.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: senderWallet.id,
          userId: fromId,
          receiverId: toId,
          type: "TRANSFER",
          amount: -transferAmount,
          currency: normalizedCurrency,
          description: description,
          receiptId: null,
          meta: {
            source: "transfer_out",
            toUser: toId,
            balanceBefore: senderAvailableBalance,
            balanceAfter: senderAfter,
          },
          performedBy: fromId,
        },
        t,
      );

      senderWallet.availableBalance = senderAfter;
      await senderWallet.save({ transaction: t });

      const recipientAfter = recipientAvailableBalance + transferAmount;
      await walletService.createWalletTransaction(
        {
          transaction_group_id: groupId,
          walletId: recipientWallet.id,
          userId: toId,
          receiverId: fromId,
          type: "TRANSFER",
          amount: transferAmount,
          currency: normalizedCurrency,
          description: description,
          receiptId: null,
          meta: {
            source: "transfer_in",
            fromUser: fromId,
            balanceBefore: recipientAvailableBalance,
            balanceAfter: recipientAfter,
          },
          performedBy: fromId,
        },
        t,
      );

      recipientWallet.availableBalance = recipientAfter;
      await recipientWallet.save({ transaction: t });

      await t.commit();
      return { transaction_group_id: groupId };
    } catch (error) {
      await t.rollback();
      console.error("Error transferring balance:", error);
      throw error;
    }
  }
}

module.exports = PaymentService;
