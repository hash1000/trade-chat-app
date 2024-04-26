const Payment = require('../models/payment')
const Card = require('../models/card')
const FavouritePayment = require('../models/favourite_payments')
const PaymentRequest = require('../models/payment_request')

class PaymentRepository {
  async createPayment (paymentData) {
    return Payment.create(paymentData)
  }

  async update (paymentId, updatedPaymentData) {
    const payment = await this.getById(paymentId)
    if (!payment) {
      throw new Error('Payment not found')
    }
    return payment.update(updatedPaymentData)
  }

  // Get a payment by ID
  async getById (paymentId) {
    return Payment.findByPk(paymentId)
  }

  // Get a payment requet by ID
  async getRequestById (requestId) {
    return PaymentRequest.findByPk(requestId)
  }

  // Get a favourite payment by ID
  async getFavouriteById (favouriteId) {
    return FavouritePayment.findByPk(favouriteId)
  }

  async delete (paymentId) {
    return Payment.destroy({
      where: { id: paymentId }
    })
  }

  async getByUserId (userId) {
    return Payment.findAll({
      where: { userId }
    })
  }

  async getCardsByUser (userId) {
    return Card.findAll({
      where: { userId }
    })
  }

  async addCard(cardData) {
    return Card.create(cardData)
  }

  async deleteCard (cardId) {
    return Card.destroy({
      where: { id: cardId }
    })
  }

  async favouritePayment (paymentId, userId) {
    const payment = await this.getRequestById(paymentId)
    if (!payment) {
      throw new Error('Payment not found')
    }
    // create a favourite payment record
    // and return it
    return FavouritePayment.create({
      userId,
      paymentId
    })
  }

  async unfavouritePayment (paymentId, userId) {
    const payment = await this.getRequestById(paymentId)
    if (!payment) {
      throw new Error('Payment not found')
    }
    // delete the favourite payment record
    // and return a success message
    await FavouritePayment.destroy({
      where: {
        userId,
        paymentId
      }
    })
  }

  async createPaymentRequest(requesterId, requesteeId, amount, status) {
    return PaymentRequest.create({
      requesterId,
      requesteeId,
      amount,
      status: status || 'pending'
    })
  }
}

module.exports = PaymentRepository
