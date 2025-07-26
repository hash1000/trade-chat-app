const sequelize = require("../config/database");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const CurrencyService = require("../services/CurrencyService");
const PaymentService = require("../services/PaymentService");

const paymentService = new PaymentService();
const currencyService = new CurrencyService();
const User = require("../models/user");

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
        await this.addBalance(payment.userId, amount, payment.accountType);
      }
      // Return the updated payment as a response
      return res.json(await updatedPayment);
    } catch (error) {
      console.error("Error updating payment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async addBalance(toUserId, amount, walletType) {
    const t = await sequelize.transaction();

    try {
      // Add balance to the receiver
      const receiver = await User.findByPk(toUserId, { transaction: t });
      if (walletType === "personal") {
        receiver.personalWalletBalance += amount;
      } else {
        receiver.companyWalletBalance += amount;
      }
      await receiver.save({ transaction: t });
      // Commit the transaction
      await t.commit();

      console.log(`Successfully transferred ${amount} units.`);
    } catch (error) {
      // If any error occurs, roll back the transaction
      await t.rollback();
      console.error("Error transferring balance:", error);
      throw error;
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

async handleStripeWebhook(req, res)  {
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
        await paymentService.handlePaymentCheckoutSucceeded(event.data.object);
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


  // Payment Type Methods
  async createPaymentType(req, res) {
    try {
      const { name, isActive = true } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Name is required",
          data: null,
        });
      }

      const paymentType = await paymentService.createPaymentType({
        name,
        isActive,
      });

      return res.status(201).json({
        success: true,
        message: "Payment type created successfully",
        data: paymentType,
      });
    } catch (error) {
      console.error("Error creating payment type:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
      });
    }
  }

  async getAllPaymentTypes(req, res) {
    try {
      const { search, isActive } = req.query;
      const paymentTypes = await paymentService.getAllPaymentTypes({
        search,
        isActive,
      });

      return res.status(200).json({
        success: true,
        message: "Payment types fetched successfully",
        data: paymentTypes,
      });
    } catch (error) {
      console.error("Error fetching payment types:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
      });
    }
  }

  async getPaymentType(req, res) {
    try {
      const { id } = req.params;
      const paymentType = await paymentService.getPaymentTypeById(id);

      if (!paymentType) {
        return res.status(404).json({
          success: false,
          message: "Payment type not found",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment type fetched successfully",
        data: paymentType,
      });
    } catch (error) {
      console.error("Error fetching payment type:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
      });
    }
  }

  async updatePaymentType(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const paymentType = await paymentService.updatePaymentType(
        id,
        updateData
      );

      if (!paymentType) {
        return res.status(404).json({
          success: false,
          message: "Payment type not found",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment type updated successfully",
        data: paymentType,
      });
    } catch (error) {
      console.error("Error updating payment type:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        data: null,
      });
    }
  }

  async deletePaymentType(req, res) {
    try {
      const { id } = req.params;

      const result = await paymentService.deletePaymentType(id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Payment type not found",
          data: null,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Payment type deleted successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error deleting payment type:", error);

      const isUsedError = error.message?.toLowerCase().includes("in use");

      return res.status(isUsedError ? 400 : 500).json({
        success: false,
        message: isUsedError ? error.message : "Internal server error",
        data: null,
      });
    }
  }
}

module.exports = PaymentController;
