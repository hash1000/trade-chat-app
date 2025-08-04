const sequelize = require("../config/database");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const CurrencyService = require("../services/CurrencyService");
const PaymentService = require("../services/PaymentService");
const UserService = require("../services/UserService");

const paymentService = new PaymentService();
const currencyService = new CurrencyService();
const userService = new UserService();

class PaymentController {
  async createPayment(req, res, next) {
    try {
      const {
        amount,
        senderName,
        orderNumber,
        accountNumber,
        accountType,
        image,
      } = req.body;
      const { id: userId } = req.user;
      // Create a new payment using the payment service
      const payment = await paymentService.createPayment({
        amount,
        senderName,
        orderNumber,
        accountNumber,
        accountType,
        userId,
        image,
      });

      // Return the created payment as a response
      return res.json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updatePayment(req, res) {
    try {
      const paymentId = req.params.id;
      const { amount, senderName, orderNumber, accountNumber } = req.body;

      // Update the payment using the payment service
      const updatedPayment = await paymentService.updatePayment(paymentId, {
        amount,
        senderName,
        orderNumber,
        accountNumber,
      });

      // Return the updated payment as a response
      return res.json(updatedPayment);
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async confirmPayment(req, res) {
    try {
      const paymentId = req.params.id;
      const { amount } = req.body;
      const { role: userRole } = req.user;
      if (userRole !== "admin") {
        res.status(400).json({ error: "User is not an admin" });
      }
      const payment = await paymentService.getPaymentById(paymentId);
      if (!payment) {
        res.status(400).json({ error: "Payment not found" });
      }
      if (payment.status === "confirmed") {
        res.status(400).json({ error: "Payment is already confirmed" });
      }
      // Update the payment using the payment service
      const updatedPayment = await paymentService.updatePayment(paymentId, {
        confirmedAmount: amount,
        status: "confirmed",
      });
      if (updatedPayment) {
        await paymentService.addBalance(
          payment.userId,
          amount,
          payment.accountType
        );
      }
      // Return the updated payment as a response
      return res.json(await updatedPayment);
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deletePayment(req, res) {
    try {
      const paymentId = req.params.id;

      // Delete the payment using the payment service
      await paymentService.deletePayment(paymentId);

      // Return a success response
      return res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUserPayments(req, res) {
    try {
      const { id: userId } = req.user;

      // Get all user payments using the payment service
      const payments = await paymentService.getUserPayments(userId);

      // Return the user payments as a response
      return res.json(payments);
    } catch (error) {
      console.error("Error fetching user payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUserCards(req, res) {
    try {
      const { id: userId } = req.user;

      // Get all user cards using the payment service
      const cards = await paymentService.getUserCards(userId);

      // Return the user cards as a response
      return res.json(cards);
    } catch (error) {
      console.error("Error fetching user cards:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async addUserCard(req, res) {
    try {
      const { id: userId } = req.user;
      const { number, expiry, cvv } = req.body;

      // Create new user card using the payment service
      const card = await paymentService.addCard({
        lastFourDigits: number.slice(-4),
        expiry,
        userId,
      });

      // Return the created card as a response
      return res.json(card);
    } catch (error) {
      console.error("Error creating user card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteUserCard(req, res) {
    try {
      const cardId = req.params.id;

      // Delete the card using the payment service
      await paymentService.deleteCard(cardId);

      // Return a success response
      return res.json({ message: "Card deleted successfully" });
    } catch (error) {
      console.error("Error deleting card:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async favouritePayment(req, res) {
    try {
      const { id: userId } = req.user;
      const paymentId = req.params.id;

      // Favourite the payment using the payment service
      const favourite = await paymentService.favouritePayment(
        paymentId,
        userId
      );

      // Return the favourite as a response
      return res.json(favourite);
    } catch (error) {
      console.error("Error favouriting payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async unfavouritePayment(req, res) {
    try {
      const { id: userId } = req.user;
      const paymentId = req.params.id;

      // Unfavourite the payment using the payment service
      await paymentService.unfavouritePayment(paymentId, userId);

      // Return a success response
      return res.json({ message: "Payment unfavourited successfully" });
    } catch (error) {
      console.error("Error unfavouriting payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async initiateTopup(req, res) {
    try {
      const { amount } = req.body;
      const { id: userId } = req.user;

      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }

      const result = await paymentService.processTopupPayment(userId, amount);

      return res.json({
        success: true,
        message: "Stripe Checkout session created",
        data: {
          checkoutUrl: result.checkoutUrl,
          amount: result.amount,
        },
      });
    } catch (error) {
      console.error("Topup error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        code: error.code || "payment_error",
      });
    }
  }

  async sendPayment(req, res) {
    try {
      const { amount, requesteeId } = req.body;
      const { id: requesterId } = req.user;

      // Validate input
      if (!amount || isNaN(amount) || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid amount" });
      }
      if (!requesteeId) {
        return res
          .status(400)
          .json({ success: false, error: "Recipient ID is required" });
      }

      const requester = await userService.getUserById(requesterId);
      if (!requester) {
        return res
          .status(404)
          .json({ success: false, error: "Requester not found" });
      }

      if (requester.personalWalletBalance < amount) {
        return res.status(400).json({
          success: false,
          error: "Insufficient funds",
          currentBalance: requester.personalWalletBalance,
          requiredAmount: amount,
        });
      }

      const recipient = await userService.getUserById(requesteeId);
      if (!recipient) {
        return res
          .status(404)
          .json({ success: false, error: "Recipient not found" });
      }

      // Initiate payment
      const result = await paymentService.sendPayment(
        requesterId,
        requesteeId,
        amount
      );

      if (!result || result.success === false) {
        return res.status(400).json({
          success: false,
          error: result.message || "Payment failed",
        });
      }

      return res.status(200).json({
        success: true,
        payment: result,
        newBalance: requester.personalWalletBalance - amount,
      });
    } catch (error) {
      console.error("Payment error:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }

  async priceAdjust(req, res) {
    try {
      const { adjustment, currency = "CNY" } = req.body;
      const userId = req.user.id;

      const result = await currencyService.setRateAdjustment(
        userId,
        currency,
        parseFloat(adjustment)
      );

      return res.json({
        success: true,
        message: "Currency rate adjustment set successfully",
        data: result,
      });
    } catch (error) {
      console.error("Currency adjustment error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        code: error.code || "CURRENCY_ADJUSTMENT_ERROR",
      });
    }
  }

  async getCurrentRate(req, res) {
    try {
      const { currency = "CNY" } = req.query;
      const rateInfo = await currencyService.getAdjustedRate(currency);

      return res.json({
        success: true,
        message: "Currency rate retrieved successfully",
        data: rateInfo,
      });
    } catch (error) {
      console.error("Get rate error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        code: error.code || "GET_RATE_ERROR",
      });
    }
  }

  // paymentController.js

  async handleStripeWebhook(req, res) {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !endpointSecret) {
      console.error("Missing Stripe signature or webhook secret");
      return res.status(400).send("Webhook Error: Missing signature or secret");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(`⚠️ Webhook signature error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await paymentService.handlePaymentCheckoutSucceeded(
            event.data.object
          );
          break;

        case "checkout.session.canceled":
        case "checkout.session.expired":
        case "checkout.session.async_payment_failed":
          await paymentService.handleCheckoutSessionCanceled(event.data.object);
          break;

        case "payment_intent.canceled":
          await paymentService.handlePaymentIntentCanceled(event.data.object);
          break;

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
          break;
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      return res.status(400).json({ error: err.message });
    }
  }

  // ------------------- PAYMENT TYPE -------------------

  async createPaymentType(req, res) {
    try {
      const { name } = req.body;
      const { id: userId } = req.user;

      const result = await paymentService.createPaymentType({ name, userId });
      res
        .status(201)
        .json({ success: true, message: "Payment type created", data: result });
    } catch (error) {
      console.error("Create payment type error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAllPaymentTypes(req, res) {
    try {
      const { search } = req.query;
      const { id: userId } = req.user;

      const result = await paymentService.getAllPaymentTypes({
        search,
        userId,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error("Get all payment types error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getPaymentType(req, res) {
    try {
      const { id } = req.params;
      const result = await paymentService.getPaymentTypeById(id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Payment type not found" });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Get payment type by ID error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updatePaymentType(req, res) {
    try {
      const { id } = req.params;
      const result = await paymentService.updatePaymentType(id, req.body);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Payment type not found" });
      res.json({
        success: true,
        message: "Payment type updated",
        data: result,
      });
    } catch (error) {
      console.error("Update payment type error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deletePaymentType(req, res) {
    try {
      const { id } = req.params;
      const result = await paymentService.deletePaymentType(id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Payment type not found" });
      res.json({ success: true, message: "Payment type deleted" });
    } catch (error) {
      const isUsed = error.message?.toLowerCase().includes("in use");
      console.error("Delete payment type error:", error);
      res.status(isUsed ? 400 : 500).json({
        success: false,
        message: isUsed ? error.message : "Internal server error",
      });
    }
  }

  // ------------------- LEDGER -------------------

  async bulkCreateLedgers(req, res) {
    try {
      const { ledgers } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.bulkCreateLedgers({
        ledgers,
        userId,
      });
      res.status(201).json({
        success: true,
        message: "Ledgers created successfully",
        data: result,
      });
    } catch (error) {
      console.error("Bulk create ledgers error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async addLedger(req, res) {
    try {
      const { title, description } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.addLedger({
        title,
        description,
        userId,
      });
      res.json({ success: true, message: "Ledger added", data: result });
    } catch (error) {
      console.error("Add ledger error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getUserLedgers(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await paymentService.getUserLedgers(userId);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Get ledgers error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getLedgerById(req, res) {
    try {
      const result = await paymentService.getLedgerById(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Ledger not found" });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Get ledger by ID error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateLedger(req, res) {
    try {
      const result = await paymentService.updateLedger(req.params.id, req.body);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Ledger not found" });
      res.json({ success: true, message: "Ledger updated" });
    } catch (error) {
      console.error("Update ledger error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteLedger(req, res) {
    try {
      const result = await paymentService.deleteLedger(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Ledger not found" });
      res.json({ success: true, message: "Ledger deleted" });
    } catch (error) {
      console.error("Delete ledger error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async addBulkLedgerTransactions(req, res) {
    try {
      const { id: ledgerId } = req.params;
      const { incomes = [], expenses = [] } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.addBulkLedgerTransactions({
        ledgerId,
        incomes,
        expenses,
        userId,
      });
      res.status(201).json({
        success: true,
        message: "Incomes and expenses added to ledger",
        data: result,
      });
    } catch (error) {
      console.error("Bulk ledger transaction error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ------------------- LEDGER -------------------

  async bulkCreateLedgers(req, res) {
    try {
      const { ledgers } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.bulkCreateLedgers({
        ledgers,
        userId,
      });
      res.status(201).json({
        success: true,
        message: "Ledgers created successfully",
        data: result,
      });
    } catch (error) {
      console.error("Bulk create ledgers error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async addLedger(req, res) {
    try {
      const { title, description } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.addLedger({
        title,
        description,
        userId,
      });
      res.json({ success: true, message: "Ledger added", data: result });
    } catch (error) {
      console.error("Add ledger error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getUserLedgers(req, res) {
    try {
      const { id: userId } = req.user;
      const result = await paymentService.getUserLedgers(userId);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Get ledgers error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getLedgerById(req, res) {
    try {
      const result = await paymentService.getLedgerById(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Ledger not found" });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error("Get ledger by ID error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateLedger(req, res) {
    try {
      const result = await paymentService.updateLedger(req.params.id, req.body);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Ledger not found" });
      res.json({ success: true, message: "Ledger updated" });
    } catch (error) {
      console.error("Update ledger error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async duplicateLedger(req, res) {
    try {
      const { id: originalLedgerId } = req.params;
      const { id: userId } = req.user;

      const duplicated = await paymentService.duplicateLedger(
        originalLedgerId,
        userId
      );
      res.json({
        success: true,
        message: "Ledger duplicated successfully",
        data: duplicated,
      });
    } catch (error) {
      console.error("Ledger duplication failed:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async deleteLedger(req, res) {
    try {
      const result = await paymentService.deleteLedger(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Ledger not found" });
      res.json({ success: true, message: "Ledger deleted" });
    } catch (error) {
      console.error("Delete ledger error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async addBulkLedgerTransactions(req, res) {
    try {
      const { id: ledgerId } = req.params;
      const { incomes = [], expenses = [] } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.addBulkLedgerTransactions({
        ledgerId,
        incomes,
        expenses,
        userId,
      });
      res.status(201).json({
        success: true,
        message: "Incomes and expenses added to ledger",
        data: result,
      });
    } catch (error) {
      console.error("Bulk ledger transaction error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async addIncomeQRM(req, res) {
    try {
      const { amount, description, paymentTypeId, ledgerId } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.addIncomeQRM({
        amount,
        description,
        paymentTypeId,
        ledgerId,
        userId,
      });
      res.json({ success: true, message: "Income added", data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getIncomeById(req, res) {
    try {
      const result = await paymentService.getIncomeById(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Income not found" });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateIncome(req, res) {
    try {
      const result = await paymentService.updateIncome(req.params.id, req.body);
      res.json({ success: true, message: "Income updated", data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteIncome(req, res) {
    try {
      await paymentService.deleteIncome(req.params.id);
      res.json({ success: true, message: "Income deleted" });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async addExpenseQRM(req, res) {
    try {
      const { amount, description, paymentTypeId, ledgerId } = req.body;
      const { id: userId } = req.user;
      const result = await paymentService.addExpenseQRM({
        amount,
        description,
        paymentTypeId,
        ledgerId,
        userId,
      });
      res.json({ success: true, message: "Expense added", data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getExpenseById(req, res) {
    try {
      const result = await paymentService.getExpenseById(req.params.id);
      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Expense not found" });
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateExpense(req, res) {
    try {
      const result = await paymentService.updateExpense(
        req.params.id,
        req.body
      );
      res.json({ success: true, message: "Expense updated", data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async deleteExpense(req, res) {
    try {
      await paymentService.deleteExpense(req.params.id);
      res.json({ success: true, message: "Expense deleted" });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = PaymentController;
