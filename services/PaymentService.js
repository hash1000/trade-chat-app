const sequelize = require("../config/database");
const WalletService = require("./WalletService");
const PaymentRepository = require("../repositories/PaymentRepository");
const PaymentRequest = require("../models/payment_request");
const { Transaction, PaymentType } = require("../models");
const User = require("../models/user");
const CurrencyService = require("./CurrencyService");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const currencyService = new CurrencyService();
class PaymentService {
  constructor() {
    this.paymentRepository = new PaymentRepository();
  }
  // Create a Stripe customer when user registers
  async createStripeCustomer(user, email) {
    console.log(">>>", user, email);
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: user.id, // Link to your internal user ID
      },
    });

    // Save stripeCustomerId to your user in database
    const updatedUser = await WalletService.updateCustomerId(user, customer.id);
    console.log("updatedUser", updatedUser);
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

  async cancelPaymentRelation(requesterId, requesteeId) {
    return PaymentRequest.destroy({
      where: {
        [Op.or]: [{ requesterId: requesterId }, { requesteeId: requesteeId }],
      },
    });
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
  async processTopupPayment(userId, amount) {
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
              description: `Wallet top-up for ${user.email}`,
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

  // Payment Type Methods
  async createPaymentType(paymentTypeData) {
    // Check if payment type already exists for this user
    const existingType =
      await this.paymentRepository.getPaymentTypeByNameAndUser(
        paymentTypeData.name,
        paymentTypeData.userId
      );

    if (existingType) {
      throw new Error(
        "Payment type with this name already exists for your account"
      );
    }

    return this.paymentRepository.createPaymentType(paymentTypeData);
  }

  async getAllPaymentTypes({ search, isActive, userId }) {
    const where = { userId }; // Only get payment types for this user

    if (search) {
      where[Op.or] = [{ name: { [Op.iLike]: `%${search}%` } }];
    }

    if (isActive === "true" || isActive === "false") {
      where.isActive = isActive === "true";
    }

    return this.paymentRepository.getAllPaymentTypes(where);
  }

  async getPaymentTypeById(id) {
    return this.paymentRepository.getPaymentTypeById(id);
  }

  async updatePaymentType(id, updateData) {
    // Check if name is being changed to one that already exists
    if (updateData.name) {
      const existingType = await this.paymentRepository.getPaymentTypeByName(
        updateData.name
      );
      if (existingType && existingType.id !== parseInt(id)) {
        throw new Error("Payment type with this name already exists");
      }
    }

    return this.paymentRepository.updatePaymentType(id, updateData);
  }

  async deletePaymentType(id) {
    const inUse = await this.paymentRepository.isPaymentTypeInUse(id);
    if (inUse) {
      throw new Error("Cannot delete - payment type is in use");
    }

    return this.paymentRepository.deletePaymentType(id);
  }

  async createBalanceSheet({ ledgers, userId }) {
    const transaction = await sequelize.transaction();
    try {
      const balanceSheet = await this.paymentRepository.addBalanceSheet(
        { userId },
        { transaction }
      );
      console.log(balanceSheet);

      for (const ledgerData of ledgers) {
        const { title, description, incomes = [], expenses = [] } = ledgerData;

        const ledger = await this.paymentRepository.addLedger(
          { title, description, balanceSheetId: balanceSheet.id },
          { transaction }
        );

        // Validate all paymentTypeIds before inserting
        const paymentTypeIdsToCheck = [
          ...incomes.map((i) => i.paymentTypeId),
          ...expenses.map((e) => e.paymentTypeId),
        ];

        const uniqueIds = [...new Set(paymentTypeIdsToCheck)];

        const foundPaymentTypes = await PaymentType.findAll({
          where: { id: uniqueIds, userId },
          transaction,
        });

        if (foundPaymentTypes.length !== uniqueIds.length) {
          await transaction.rollback();
          const foundIds = foundPaymentTypes.map((p) => p.id);
          const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));
          throw new Error(
            `Invalid or missing paymentTypeId(s): ${missingIds.join(", ")}`
          );
        }

        // Proceed with creating incomes and expenses
        if (Array.isArray(incomes) && incomes.length > 0) {
          const incomesData = incomes.map((i) => ({
            ...i,
            ledgerId: ledger.id,
          }));
          await this.paymentRepository.bulkCreateIncome(incomesData, {
            transaction,
          });
        }

        if (Array.isArray(expenses) && expenses.length > 0) {
          const expensesData = expenses.map((e) => ({
            ...e,
            ledgerId: ledger.id,
          }));
          await this.paymentRepository.bulkCreateExpense(expensesData, {
            transaction,
          });
        }
      }

      await transaction.commit();
      return { balanceSheetId: balanceSheet.id };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getBalanceSheetsByUser(userId) {
    const balanceSheets = await this.paymentRepository.getBalanceSheetsByUser(
      userId
    );

    return balanceSheets.map((sheet) => {
      let sheetTotalIncome = 0;
      let sheetTotalExpense = 0;

      const ledgers = sheet.ledgers.map((ledger) => {
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

        sheetTotalIncome += totalIncome;
        sheetTotalExpense += totalExpense;

        return {
          ...ledger.toJSON(),
          totalIncome,
          totalExpense,
          balance,
        };
      });

      return {
        ...sheet.toJSON(),
        ledgers,
        totalIncome: sheetTotalIncome,
        totalExpense: sheetTotalExpense,
        balance: sheetTotalIncome - sheetTotalExpense,
      };
    });
  }

  async getBalanceSheetById(id) {
    return this.paymentRepository.getBalanceSheetById(id);
  }

  async updateBalanceSheet(id, updateData) {
    return this.paymentRepository.updateBalanceSheet(id, updateData);
  }

  async deleteBalanceSheet(id) {
    return this.paymentRepository.deleteBalanceSheet(id);
  }

  // LEDGER
  async addLedger(data) {
    return this.paymentRepository.addLedger(data);
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

  async updateLedger(id, updateData) {
    return this.paymentRepository.updateLedger(id, updateData);
  }

  async deleteLedger(id) {
    return this.paymentRepository.deleteLedger(id);
  }

  // INCOME
  async addIncomeQRM(data) {
    return this.paymentRepository.addIncomeQRM(data);
  }

  async getIncomeById(id) {
    return this.paymentRepository.getIncomeById(id);
  }

  async updateIncome(id, updateData) {
    return this.paymentRepository.updateIncome(id, updateData);
  }

  async deleteIncome(id) {
    return this.paymentRepository.deleteIncome(id);
  }

  // EXPENSE
  async addExpenseQRM(data) {
    return this.paymentRepository.addExpenseQRM(data);
  }

  async getExpenseById(id) {
    return this.paymentRepository.getExpenseById(id);
  }

  async updateExpense(id, updateData) {
    return this.paymentRepository.updateExpense(id, updateData);
  }

  async deleteExpense(id) {
    return this.paymentRepository.deleteExpense(id);
  }
}

module.exports = PaymentService;
