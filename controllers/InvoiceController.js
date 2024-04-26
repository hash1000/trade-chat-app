const InvoiceService = require('../services/InvoiceService')
const invoiceService = new InvoiceService()

class InvoiceController {
  async createInvoice (req, res) {
    try {
      const { id: userId } = req.user
      const { orderId } = req.body
      const cart = await invoiceService.createInvoice(userId, orderId)
      res.json(cart)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  };

  async updateInvoice (req, res) {
    try {
      const { id: orderId } = req.params
      const { name, number, date, paymentTerm, deliveryTerm } = req.body
      const cart = await invoiceService.updateInvoice(orderId, { name, number, date, paymentTerm, deliveryTerm })
      res.json(cart)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  };

  async getInvoice (req, res) {
    try {
      const { id: invoiceId } = req.params
      // Get the user's orders
      const invoice = await invoiceService.getInvoice(invoiceId)

      res.json(invoice)
    } catch (error) {
      console.error('Error fetching user invoice:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async getUserInvoices (req, res) {
    try {
      const { id: userId } = req.user

      // Get the user's orders
      const userInvoices = await invoiceService.getUserInvoices(userId)

      res.json(userInvoices)
    } catch (error) {
      console.error('Error fetching user invoice:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async deleteInvoice (req, res) {
    try {
      const invoiceId = req.params.id
      // Delete the order
      console.log(invoiceId)
      await invoiceService.deleteInvoice(invoiceId)
      res.json({ message: 'Invoice deleted successfully' })
    } catch (error) {
      console.error('Error deleting Invoice:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

module.exports = InvoiceController
