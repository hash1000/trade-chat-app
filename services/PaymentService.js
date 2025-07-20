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

async  handlePaymentIntentSucceeded(paymentIntent) {
  console.log("Payment intent succeeded:", paymentIntent.id);
  if (!paymentIntent.metadata?.purpose === 'wallet_topup') return;

  const userId = paymentIntent.metadata.userId;
  const amountInDollars = paymentIntent.amount / 100;
  console.log(`Processing top-up of $${amountInDollars} for user ${userId}`);
  try {
    // 1. Get current rate (with error handling)
    const rateResponse = await currencyService.getAdjustedRate('CNY').catch(err => {
      throw new Error(`Failed to get exchange rate: ${err.message}`);
    });
    
    if (!rateResponse?.finalRate) {
      throw new Error('Invalid rate response format');
    }

    const finalRate = rateResponse.finalRate;
    const amountToAdd = Math.floor(amountInDollars * finalRate);
console.log(`Final rate: ${finalRate}, Amount to add: ${amountToAdd} CNY`);
    // 2. Start transaction for data consistency
    await sequelize.transaction(async (t) => {
      // 3. Update user balance
      const user = await User.findByPk(userId, { transaction: t });
      if (!user) throw new Error(`User ${userId} not found`);

      user.personalWalletBalance += amountToAdd;
      await user.save({ transaction: t });

      // 4. Create transaction record
      const trans = await Transaction.create({
        userId,
        amount: amountToAdd,
        usdAmount: amountInDollars,
        rate: finalRate,
        currency: 'CNY',
        type: 'wallet_topup',
        status: 'completed',
        reference: paymentIntent.id,
        metadata: {
          stripeEvent: 'payment_intent.succeeded',
          chargeId: paymentIntent.latest_charge
        }
      }, { transaction: t });

      console.log(`Successfully processed $${amountInDollars} payment (converted to ${amountToAdd} CNY) ${trans}`);
    });

  } catch (error) {
    console.error('Payment processing failed:', error);
    // Implement your error notification system here
    throw error; // Will trigger Stripe's retry mechanism
  }
}

}

module.exports = PaymentService;
