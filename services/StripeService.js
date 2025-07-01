// services/stripeService.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  async createPaymentIntent(amount, userId, currency = 'usd') {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100, // convert to cents
        currency,
        metadata: {
          userId: userId.toString(),
        },
      });
      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async handleWebhookEvent(event) {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return this.handlePaymentSuccess(event.data.object);
      case 'payment_intent.payment_failed':
        return this.handlePaymentFailure(event.data.object);
      default:
        return { received: true };
    }
  }

  async handlePaymentSuccess(paymentIntent) {
    const { metadata, amount } = paymentIntent;
    const userId = parseInt(metadata.userId);
    
    // Add funds to user's wallet
    await this.creditUserWallet(userId, amount / 100); // convert back to dollars
    
    return { success: true };
  }

  async creditUserWallet(userId, amount) {
    // This would be implemented in your user service
    // It would update the user's personalWalletBalance and create a transaction record
  }
}

module.exports = new StripeService();