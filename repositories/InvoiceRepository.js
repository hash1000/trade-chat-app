const Invoice = require('../models/invoice')
const sequelize = require('../config/database')

class InvoiceRepository {
  async getInvoiceById (invoiceId) {
    return await Invoice.findByPk(invoiceId)
  }

  async storeInvoice (userId, order) {
    try {
      let sum = 0
      if (order && order.orderProducts) {
        order.orderProducts.forEach((product) => {
          sum += product.Product.price * product.quantity
        })
      }

      return await Invoice.create({
        bundle: order,
        total: sum,
        userId
      })
    } catch (error) {
      console.error('Error adding invoice to table:', error)
      throw error
    }
  }

  async updateInvoice (invoice, payload) {
    const { name, type, number, date, paymentTerm, deliveryTerm, bundle } = payload
    try {
      if (name) {
        invoice.name = name
      }
      if (type) {
        invoice.type = type
      }
      if (number) {
        invoice.number = number
      }
      if (date) {
        invoice.date = date
      }
      if (paymentTerm) {
        invoice.paymentTerm = paymentTerm
      }
      if (deliveryTerm) {
        invoice.deliveryTerm = deliveryTerm
      }
      if (bundle) {
        invoice.bundle = bundle
      }
      // Save the updated invoice
      return await invoice.save()
    } catch (error) {
      console.error('Error updating invoice to table:', error)
      throw error
    }
  }

  async getUserInvoices (userId) {
    // Retrieve the user's orders from the database
    return await Invoice.findAll({
      where: { userId }
    })
  }

  async deleteInvoice (invoiceId) {
    let transaction
    try {
      transaction = await sequelize.transaction()
      // Check if the order exists
      const invoice = await this.getInvoiceById(invoiceId)
      if (!invoice) {
        throw new Error('Invoice not found')
      }
      // Delete the order
      await Invoice.destroy({
        where: { id: invoiceId },
        transaction
      })

      await transaction.commit()
    } catch (error) {
      if (transaction) await transaction.rollback()
      throw error
    }
  }
}

module.exports = InvoiceRepository
