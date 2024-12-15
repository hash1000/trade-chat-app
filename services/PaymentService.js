const PaymentRepository = require('../repositories/PaymentRepository')
const PaymentRequest = require('../models/payment_request');
const { Op } = require("sequelize");

class PaymentService {
  constructor () {
    this.paymentRepository = new PaymentRepository()
  }
  async createPayment (paymentData) {
    // Perform any necessary validation or business logic checks here
    // Example: Check if the account type is valid, validate the payment amount, etc.

    return this.paymentRepository.createPayment(paymentData)
  }

  async updatePayment (paymentId, updatedPaymentData) {
    // Add any additional business logic or validation before updating the payment
    return this.paymentRepository.update(paymentId, updatedPaymentData)
  }

  async deletePayment (paymentId) {
    // Add any additional business logic or validation before deleting the payment
    return this.paymentRepository.delete(paymentId)
  }

  
  async cancelPaymentRelation(requesterId, requesteeId) {
    return PaymentRequest.destroy({
      where: {
        [Op.or]: [
          { requesterId: requesterId },
          { requesteeId: requesteeId }
        ],
      }
    });
  }

  async getUserPayments (userId) {
    // Add any additional business logic or validation before retrieving user payments
    return this.paymentRepository.getByUserId(userId)
  }

  async getPaymentById (paymentId) {
    return this.paymentRepository.getById(paymentId)
  }

  async getUserCards(userId) {
    return this.paymentRepository.getCardsByUser(userId)
  }

  async addCard(cardData) {
    return this.paymentRepository.addCard(cardData)
  }

  async deleteCard (cardId) {
    // Add any additional business logic or validation before deleting the card
    return this.paymentRepository.deleteCard(cardId)
  }

  async favouritePayment (paymentId, userId) {
    // Add any additional business logic or validation before favouriting the payment
    return this.paymentRepository.favouritePayment(paymentId, userId)
  }

  async unfavouritePayment (paymentId, userId) {
    // Add any additional business logic or validation before unfavouriting the payment
    return this.paymentRepository.unfavouritePayment(paymentId, userId)
  }
}

module.exports = PaymentService
