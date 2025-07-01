const WalletService = require("./WalletService");
const PaymentRepository = require("../repositories/PaymentRepository");
const PaymentRequest = require("../models/payment_request");
const { Transaction } = require("../models");
const User = require("../models/user");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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

  async processTopupPayment(userId, amount, cardDetails) {
    // Get user from database
    const user = await WalletService.getUserWalletById(userId);

    // Create or retrieve Stripe customer
    let customer;
    if (!user.stripeCustomerId) {
      customer = await this.createStripeCustomer(user);
      await WalletService.updateCustomerId(user, customer.id);
    } else {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    }

    // Create payment method
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: cardDetails.card_number,
        exp_month: cardDetails.exp_month,
        exp_year: cardDetails.exp_year,
        cvc: cardDetails.cvc,
      },
    });

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethod.id, {
      customer: customer.id,
    });

    // Set as default payment method
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: "usd",
      customer: customer.id,
      payment_method: paymentMethod.id,
      confirm: true,
      off_session: true,
      metadata: {
        userId: user.id,
        purpose: "wallet_topup",
      },
      description: `Wallet top-up for ${user.email}`,
    });

    // Create transaction record
    const transaction = await paymentRepository.createTransaction({
      userId: user.id,
      stripePaymentIntentId: paymentIntent.id,
      amount: amount,
      type: "topup",
      status: paymentIntent.status,
      paymentMethod: "card",
    });
    return {
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: amount,
      transaction: transaction,
    };
  }
}

module.exports = PaymentService;
