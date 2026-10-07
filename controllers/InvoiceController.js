const InvoiceService = require('../services/InvoiceService')
const { CUSTOM } = require('../repositories/InvoiceRepository')
const invoiceService = new InvoiceService()

/** The invoice when it belongs to the caller, otherwise null (answered as 404). */
async function ownInvoice (req) {
  const invoice = await invoiceService.getInvoice(req.params.id).catch(() => null)
  return invoice && Number(invoice.userId) === Number(req.user.id) ? invoice : null
}

class InvoiceController {
  async createInvoice (req, res) {
    try {
      const { id: userId } = req.user
      const { orderId } = req.body
      if (req.body.type === CUSTOM) {
        const { name, number, date, paymentTerm, deliveryTerm, bundle, total } = req.body
        const invoice = await invoiceService.createCustomInvoice(userId, { name, number, date, paymentTerm, deliveryTerm, bundle, total })
        return res.status(201).json(invoice)
      }
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
      const invoice = await ownInvoice(req)
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
      const { name, number, date, paymentTerm, deliveryTerm } = req.body
      // Hand-written invoices keep their lines and total in `bundle` / `total`.
      const extra = invoice.type === CUSTOM ? { bundle: req.body.bundle, total: req.body.total } : {}
      const cart = await invoiceService.updateInvoice(orderId, { name, number, date, paymentTerm, deliveryTerm, ...extra })
      res.json(cart)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Server Error' })
    }
  };

  async getInvoice (req, res) {
    try {
      const invoice = await ownInvoice(req)
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

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
      const userInvoices = await invoiceService.getUserInvoices(userId, { custom: req.query.type === CUSTOM })

      res.json(userInvoices)
    } catch (error) {
      console.error('Error fetching user invoice:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }

  async deleteInvoice (req, res) {
    try {
      const invoiceId = req.params.id
      if (!(await ownInvoice(req))) return res.status(404).json({ error: 'Invoice not found' })
      await invoiceService.deleteInvoice(invoiceId)
      res.json({ message: 'Invoice deleted successfully' })
    } catch (error) {
      console.error('Error deleting Invoice:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

module.exports = InvoiceController
