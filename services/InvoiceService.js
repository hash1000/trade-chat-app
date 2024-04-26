const InvoiceRepository = require('../repositories/InvoiceRepository')
const OrderService = require('./OrderService')
const CustomError = require('../errors/CustomError')

class InvoiceService {
  constructor () {
    this.invoiceRepository = new InvoiceRepository()
  }

  async createInvoice (userId, orderId) {
    const orderService = new OrderService()
    const order = await orderService.getOrderById(orderId)
    return await this.invoiceRepository.storeInvoice(userId, order)
  };

  async updateInvoice (orderId, payload) {
    const invoice = await this.invoiceRepository.getInvoiceById(orderId)
    if (!invoice) {
      throw new Error('Invoice not found')
    }

    return await this.invoiceRepository.updateInvoice(invoice, payload)
  };

  async getUserInvoices (userId) {
    // Retrieve the user's orders from the repository
    return await this.invoiceRepository.getUserInvoices(userId)
  }

  async getInvoice (invoiceId) {
    // Retrieve the user's orders from the repository
    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId)
    if (!invoice) {
      throw new CustomError('Invoice not found', 404)
    }
    return invoice
  }

  async deleteInvoice (invoiceId) {
    await this.invoiceRepository.deleteInvoice(invoiceId)
  }
};

module.exports = InvoiceService
