const Payment = require("../models/payment");
const Card = require("../models/card");
const FavouritePayment = require("../models/favourite_payments");
const PaymentRequest = require("../models/payment_request");
const Transaction = require("../models/transaction");
const {
  User,
  Role,
  Income,
  Expense,
  Ledger,
  BalanceSheet,
} = require("../models");
const PaymentType = require("../models/paymentType");

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
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });
  }
  async createPaymentType(paymentTypeData) {
    return PaymentType.create(paymentTypeData);
  }

  async getPaymentTypeByName(name) {
    return PaymentType.findOne({ where: { name } });
  }

  async getAllPaymentTypes(where = {}) {
    return PaymentType.findAll({
      where,
      order: [["name", "ASC"]],
    });
  }

  async getPaymentTypeById(id) {
    return PaymentType.findByPk(id);
  }

  async updatePaymentType(id, updateData) {
    const paymentType = await PaymentType.findByPk(id);
    if (!paymentType) return null;
    return paymentType.update(updateData);
  }

  async deletePaymentType(id) {
    const paymentType = await PaymentType.findByPk(id);
    if (!paymentType) return null;
    await paymentType.destroy();
    return true;
  }

  async isPaymentTypeInUse(id) {
    const [inIncomes, inExpenses] = await Promise.all([
      Income.count({ where: { paymentTypeId: id } }),
      Expense.count({ where: { paymentTypeId: id } }),
    ]);
    return inIncomes > 0 || inExpenses > 0;
  }

  async getPaymentTypeByNameAndUser(name, userId) {
    return PaymentType.findOne({ where: { name, userId } });
  }

  async findExistingPaymentTypeIds(ids) {
    const rows = await PaymentType.findAll({
      where: { id: ids },
      attributes: ["id"],
      raw: true,
    });
    return rows.map((r) => r.id);
  }

  // BALANCE SHEET
  async getBalanceSheetsByUser(userId) {
    return BalanceSheet.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Ledger,
          as: "ledgers",
          include: [
            {
              model: Income,
              as: "incomes",
              include: [{ model: PaymentType, as: "paymentType" }],
            },
            {
              model: Expense,
              as: "expenses",
              include: [{ model: PaymentType, as: "paymentType" }],
            },
          ],
        },
      ],
    });
  }

  async getBalanceSheetById(id) {
    return BalanceSheet.findByPk(id, {
      include: [
        {
          model: Ledger,
          as: "ledgers",
          include: [
            {
              model: Income,
              as: "incomes",
              include: [{ model: PaymentType, as: "paymentType" }],
            },
            {
              model: Expense,
              as: "expenses",
              include: [{ model: PaymentType, as: "paymentType" }],
            },
          ],
        },
      ],
    });
  }

  async addBalanceSheet(data, options) {
    return BalanceSheet.create(data, options);
  }

  async updateBalanceSheet(id, data) {
    const sheet = await BalanceSheet.findByPk(id);
    if (!sheet) return null;
    return sheet.update(data);
  }

  async deleteBalanceSheet(id) {
    const sheet = await BalanceSheet.findByPk(id);
    if (!sheet) return null;
    await sheet.destroy();
    return true;
  }

  // LEDGER
  async addLedger(data, options = {}) {
    return Ledger.create(data, options);
  }

  async getLedgerById(id) {
    return Ledger.findByPk(id, {
      include: [
        {
          model: Income,
          as: "incomes",
          include: [{ model: PaymentType, as: "paymentType" }],
        },
        {
          model: Expense,
          as: "expenses",
          include: [{ model: PaymentType, as: "paymentType" }],
        },
      ],
    });
  }

  async updateLedger(id, data) {
    const ledger = await Ledger.findByPk(id);
    if (!ledger) return null;
    return ledger.update(data);
  }

  async deleteLedger(id) {
    const ledger = await Ledger.findByPk(id);
    if (!ledger) return null;
    await ledger.destroy();
    return true;
  }

  // INCOME
  async addIncomeQRM(data) {
    const ledger = await Ledger.findByPk(data.ledgerId);
    if (!ledger) throw new Error("Ledger not found");
    const paymentType = await PaymentType.findByPk(data.paymentTypeId);
    if (!paymentType) throw new Error("Payment type not found");
    return Income.create(data);
  }

  async getIncomeById(id) {
    return Income.findByPk(id, {
      include: [{ model: PaymentType, as: "paymentType" }],
    });
  }

  async updateIncome(id, data) {
    const income = await Income.findByPk(id);
    if (!income) return null;
    return income.update(data);
  }

  async deleteIncome(id) {
    const income = await Income.findByPk(id);
    if (!income) return null;
    await income.destroy();
    return true;
  }

  async bulkCreateIncome(data, options) {
    return Income.bulkCreate(data, options);
  }

  // EXPENSE
  async addExpenseQRM(data) {
    const ledger = await Ledger.findByPk(data.ledgerId);
    if (!ledger) throw new Error("Ledger not found");
    const paymentType = await PaymentType.findByPk(data.paymentTypeId);
    if (!paymentType) throw new Error("Payment type not found");
    return Expense.create(data);
  }

  async getExpenseById(id) {
    return Expense.findByPk(id, {
      include: [{ model: PaymentType, as: "paymentType" }],
    });
  }

  async updateExpense(id, data) {
    const expense = await Expense.findByPk(id);
    if (!expense) return null;
    return expense.update(data);
  }

  async deleteExpense(id) {
    const expense = await Expense.findByPk(id);
    if (!expense) return null;
    await expense.destroy();
    return true;
  }

  async bulkCreateExpense(data, options) {
    return Expense.bulkCreate(data, options);
  }
}

module.exports = PaymentRepository;
