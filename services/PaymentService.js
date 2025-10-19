const { Op } = require("sequelize");
const sequelize = require("../config/database");
const WalletService = require("./WalletService");
const PaymentRepository = require("../repositories/PaymentRepository");
const PaymentRequest = require("../models/payment_request");
const { Transaction, PaymentType } = require("../models");
const User = require("../models/user");
const CurrencyService = require("./CurrencyService");
const { PaymentTypes } = require("../constants");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const currencyService = new CurrencyService();
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
    const updatedUser = await WalletService.updateCustomerId(user, customer.id);
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

  async addCard(cardData) {
    return this.paymentRepository.addCard(cardData);
  }

  async deleteCard(cardId) {
    // Add any additional business logic or validation before deleting the card
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

  // Inside paymentService.js
  async processTopupPayment(userId, amount, description) {
    const user = await WalletService.getUserWalletById(userId);
    const roundedAmount = Math.round(amount * 100); // cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Wallet Top-up",
              description: description,
            },
            unit_amount: roundedAmount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        purpose: "wallet_topup",
      },
      success_url: `http://157.230.84.217:5000/wallet/topup-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://157.230.84.217:5000/wallet/topup-cancelled`,
    });

    return {
      checkoutUrl: session.url,
      checkoutSessionId: session.id, // 👈 Add this line!
      amount,
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
          attributes: ["id", "username", "firstname", "lastname", "profilePic", "description"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  async handlePaymentCheckoutSucceeded(session) {
    console.log("✅ Checkout session completed:", session);

    const {
      metadata,
      amount_total,
      id: sessionId,
      payment_method_types,
      customer_details,
    } = session;

    if (!metadata || metadata.purpose !== "wallet_topup") {
      console.warn("Skipping non-wallet top-up session.");
      return;
    }

    const rawUserId = metadata.userId;
    const rawAmount = amount_total;

    // Defensive validation
    if (!rawUserId || isNaN(rawUserId)) {
      throw new Error("Invalid or missing userId in metadata.");
    }

    if (!rawAmount || isNaN(rawAmount)) {
      throw new Error("Invalid or missing amount_total in session.");
    }

    const userId = parseInt(rawUserId);
    const amountInUsd = parseFloat((rawAmount / 100).toFixed(2));

    try {
      const rateData = await currencyService.getAdjustedRate("CNY");
      if (!rateData?.finalRate) throw new Error("Currency rate fetch failed");

      const rate = parseFloat(rateData.finalRate.toFixed(5));
      const convertedAmount = Math.floor(amountInUsd * rate);

      console.log(
        `Converting $${amountInUsd} → ¥${convertedAmount} at rate ${rate}`
      );

      await sequelize.transaction(async (t) => {
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) throw new Error(`User not found: ${userId}`);

        user.personalWalletBalance += convertedAmount;
        await user.save({ transaction: t });

        await Transaction.create(
          {
            userId,
            amount: convertedAmount,
            usdAmount: amountInUsd,
            rate,
            currency: "CNY",
            type: "wallet_topup",
            status: "completed",
            orderId: `topup_${sessionId.slice(-8)}`,
            reference: sessionId,
            paymentMethod: payment_method_types?.[0] || "card",
            metadata: {
              stripeEvent: "checkout.session.completed",
              email: customer_details?.email || null,
              name: customer_details?.name || null,
            },
          },
          { transaction: t }
        );
      });

      console.log(
        `💰 Wallet top-up successful: $${amountInUsd} → ¥${convertedAmount}`
      );
    } catch (err) {
      console.error("❌ Payment processing failed:", err);
      throw err;
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
          (l) => l.expenses?.map((e) => e.paymentTypeId) || []
        ),
      ];

      const uniqueIds = [...new Set(allPaymentTypeIds)];
      const validIds = await this.paymentRepository.findExistingPaymentTypeIds(
        uniqueIds
      );
      const invalidIds = uniqueIds.filter((id) => !validIds.includes(id));

      if (invalidIds.length > 0) {
        throw new Error(`Invalid paymentTypeId(s): ${invalidIds.join(", ")}`);
      }

      const results = [];

      for (const {
        title,
        description,
        addNote,
        customerNote,
        incomes = [],
        expenses = [],
      } of ledgers) {
        const ledger = await this.paymentRepository.addLedger(
          { title, description, addNote, customerNote, userId },
          { transaction }
        );

        if (incomes.length > 0) {
          await this.paymentRepository.bulkCreateIncome(
            incomes.map((i) => ({ ...i, ledgerId: ledger.id })),
            { transaction }
          );
        }

        if (expenses.length > 0) {
          await this.paymentRepository.bulkCreateExpense(
            expenses.map((e) => ({ ...e, ledgerId: ledger.id })),
            { transaction }
          );
        }

        results.push(ledger);
      }

      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async addLedger(data) {
    return this.paymentRepository.addLedger(data);
  }

  async getUserLedgers(userId) {
    const ledgers = await this.paymentRepository.getLedgersByUser(userId);

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
        0
      );
      const totalExpense = expenses.reduce(
        (sum, exp) => sum + parseFloat(exp.amount || 0),
        0
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
        0
      ) || 0;
    const totalExpense =
      ledger.expenses?.reduce(
        (sum, exp) => sum + parseFloat(exp.amount || 0),
        0
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

  async duplicateLedger(originalLedgerId, userId) {
    const original = await this.paymentRepository.getLedgerWithTransactions(
      originalLedgerId
    );
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
    const validIds = await this.paymentRepository.findExistingPaymentTypeIds(
      paymentTypeIds
    );
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

  async addIncomeQRM(data) {
    const { paymentTypeId, ledgerId } = data;

    const ledger = await this.paymentRepository.getLedgerById(ledgerId);
    if (!ledger) throw new Error("Invalid ledgerId: not found");

    const paymentType = await this.paymentRepository.getPaymentTypeById(
      paymentTypeId
    );
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
        data.paymentTypeId
      );
      if (!pt) throw new Error("Invalid paymentTypeId: not found");
    }
    if (data.ledgerId) {
      const ledger = await this.paymentRepository.getLedgerById(data.ledgerId);
      if (!ledger) throw new Error("Invalid ledgerId: not found");
    }
    await this.paymentRepository.updateIncome(id, data);
    return await this.paymentRepository.getIncomeById(id);
  }

  async deleteIncome(id) {
    const deleted = await this.paymentRepository.deleteIncome(id);
    if (deleted === 0) throw new Error("Income not found or already deleted");
    return true;
  }

  // ------------------- EXPENSE -------------------
  async addExpenseQRM(data) {
    const { paymentTypeId, ledgerId } = data;

    const ledger = await this.paymentRepository.getLedgerById(ledgerId);
    if (!ledger) throw new Error("Invalid ledgerId: not found");

    const paymentType = await this.paymentRepository.getPaymentTypeById(
      paymentTypeId
    );
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
        data.paymentTypeId
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

  // ------------------- PAYMENT TYPE -------------------

  async createPaymentType(data) {
    const exists = await this.paymentRepository.getPaymentTypeByNameAndUser(
      data.name,
      data.userId
    );
    if (exists)
      throw new Error(
        "Payment type with this name already exists for your account"
      );
    return this.paymentRepository.createPaymentType(data);
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
    const paymentType = await this.paymentRepository.getPaymentTypeById(id);

    if (!paymentType) throw new Error("Payment type not found");

    if (PaymentTypes.includes(paymentType.name)) {
      throw new Error("Cannot delete permanent payment type");
    }

    if (updateData.name) {
      const existing = await this.paymentRepository.getPaymentTypeByName(
        updateData.name
      );
      if (existing && existing.id !== parseInt(id)) {
        throw new Error("Payment type with this name already exists");
      }
    }
    return this.paymentRepository.updatePaymentType(id, updateData);
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
}

module.exports = PaymentService;
