const sequelize = require("../config/database");
const WalletService = require("./WalletService");
const PaymentRepository = require("../repositories/PaymentRepository");
const PaymentRequest = require("../models/payment_request");
const { Transaction } = require("../models");
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

  async handlePaymentIntentSucceeded(paymentIntent) {
    if (!paymentIntent.metadata?.purpose === "wallet_topup") return;

    const userId = paymentIntent.metadata.userId;
    const amountInDollars = paymentIntent.amount / 100;

    try {
      const rateResponse = await currencyService.getAdjustedRate("CNY");
      if (!rateResponse?.finalRate) throw new Error("Invalid rate response");

      const finalRate = rateResponse.finalRate;
      const amountToAdd = Math.floor(amountInDollars * finalRate);

      await sequelize.transaction(async (t) => {
        const user = await User.findByPk(userId, { transaction: t });
        if (!user) throw new Error(`User ${userId} not found`);

        user.personalWalletBalance += amountToAdd;
        await user.save({ transaction: t });

        await Transaction.create(
          {
            userId,
            amount: amountToAdd,
            usdAmount: amountInDollars,
            rate: finalRate,
            currency: "CNY",
            type: "wallet_topup",
            status: "completed",
            reference: paymentIntent.id,
            orderId: `topup_${paymentIntent.id.slice(-8)}`,
            paymentMethod: paymentIntent.payment_method_types?.[0] || "stripe",
            metadata: {
              stripeEvent: "payment_intent.succeeded",
              chargeId: paymentIntent.latest_charge,
            },
          },
          { transaction: t }
        );
      });

      console.log(`Successfully processed $${amountInDollars} payment`);
    } catch (error) {
      console.error("Payment processing failed:", error);
      throw error;
    }
  }

  // Payment Type Methods
  async createPaymentType(paymentTypeData) {
    // Check if payment type already exists
    const existingType = await this.paymentRepository.getPaymentTypeByName(
      paymentTypeData.name
    );
    if (existingType) {
      throw new Error("Payment type already exists");
    }

    return this.paymentRepository.createPaymentType(paymentTypeData);
  }

  async getAllPaymentTypes({ search, isActive }) {
    const where = {};

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
}

module.exports = PaymentService;
