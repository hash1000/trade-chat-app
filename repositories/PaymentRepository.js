const Payment = require("../models/payment");
const Card = require("../models/card");
const FavouritePayment = require("../models/favourite_payments");
const PaymentRequest = require("../models/payment_request");
const Transaction = require("../models/transaction");
const { User, Role } = require("../models");

class PaymentRepository {
  async createPayment(paymentData) {
    return Payment.create(paymentData);
  }

  async update(paymentId, updatedPaymentData) {
    const payment = await this.getById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }
    return payment.update(updatedPaymentData);
  }

  // Get a payment by ID
  async getById(paymentId) {
    return Payment.findByPk(paymentId);
  }

  // Get a payment requet by ID
  async getRequestById(requestId) {
    return PaymentRequest.findByPk(requestId);
  }

  // Get a favourite payment by ID
  async getFavouriteById(favouriteId) {
    return FavouritePayment.findByPk(favouriteId);
  }

  async delete(paymentId) {
    return Payment.destroy({
      where: { id: paymentId },
    });
  }

  async getByUserId(userId) {
    return Payment.findAll({
      where: { userId },
    });
  }

  async getCardsByUser(userId) {
    return Card.findAll({
      where: { userId },
    });
  }

  async addCard(cardData) {
    return Card.create(cardData);
  }

  async deleteCard(cardId) {
    return Card.destroy({
      where: { id: cardId },
    });
  }

  async favouritePayment(paymentId, userId) {
    const payment = await this.getRequestById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }
    return FavouritePayment.create({
      userId,
      paymentId,
    });
  }

  async unfavouritePayment(paymentId, userId) {
    const payment = await this.getRequestById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }
    await FavouritePayment.destroy({
      where: {
        userId,
        paymentId,
      },
    });
  }
  
  async createPaymentRequest(requesterId, requesteeId, amount, status) {
    const paymentRequest = await PaymentRequest.create({
      requesterId,
      requesteeId,
      amount,
      status: status || "pending",
    });

    return PaymentRequest.findByPk(paymentRequest.id, {
      include: [
        {
          model: User,
          as: "requester",
          include: [
            {
              model: Role,
              as: "roles",
            },
          ],
        },
        {
          model: User,
          as: "requestee",
          include: [
            {
              model: Role,
              as: "roles",
            },
          ],
        },
      ],
    });
  }

  // Transaction-related methods
  async createTransaction(transactionData) {
    return Transaction.create(transactionData);
  }

  async getTransactionById(transactionId) {
    return Transaction.findByPk(transactionId);
  }

  async getTransactionsByUserId(userId, options = {}) {
    return Transaction.findAll({
      where: { userId },
      ...options,
    });
  }

  async updateTransaction(transactionId, updatedData) {
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    return transaction.update(updatedData);
  }

  async updateTransactionByPaymentIntent(paymentIntentId, updatedData) {
    const [affectedRows] = await Transaction.update(updatedData, {
      where: { stripePaymentIntentId: paymentIntentId },
    });
    
    if (affectedRows === 0) {
      throw new Error("Transaction not found");
    }
    
    return this.getTransactionByPaymentIntent(paymentIntentId);
  }

  async getTransactionByPaymentIntent(paymentIntentId) {
    return Transaction.findOne({
      where: { stripePaymentIntentId: paymentIntentId },
    });
  }

  async getTransactionsByStatus(status, options = {}) {
    return Transaction.findAll({
      where: { status },
      ...options,
    });
  }

  async getRecentTransactions(limit = 10) {
    return Transaction.findAll({
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
    });
  }
}

module.exports = PaymentRepository;