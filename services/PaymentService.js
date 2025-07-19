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

async processTopupPayment(userId, amount) {
  const user = await WalletService.getUserWalletById(userId);
  console.log("User for topup:", userId, amount);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // USD cents
    currency: "usd",
    metadata: {
      userId: user.id,
      purpose: "wallet_topup",
    },
    description: `Wallet top-up for ${user.email}`,
  });

  // You can save the paymentIntent.id if needed for later tracking

  return {
    clientSecret: paymentIntent.client_secret,
    amount,
  };
}

// async handleStripeWebhook(event) {
//   let event;
 
// }

}

module.exports = PaymentService;
