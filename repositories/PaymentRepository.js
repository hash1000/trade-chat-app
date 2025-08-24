const Payment = require("../models/payment");
const { Op } = require("sequelize");
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
const { PaymentTypes } = require("../constants");

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
    // return Transaction.findAll({
    //   where: { userId }
    //   ...options,
    // });
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
    // return Transaction.findAll({
    //   where: { status }
    //   ...options,
    // });
  }

  async getRecentTransactions(limit = 10) {
    return Transaction.findAll({
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
    });
  }
  // ---------------- LEDGER ----------------
  addLedger(data, options = {}) {
    return Ledger.create(data, options);
  }

  getLedgersByUser(userId) {
    return Ledger.findAll({
      where: { userId },
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
        {
          model: User,
          as: "user",
          attributes: ["id", "username"],
        },
      ],
    });
  }

  getLedgerById(id) {
    return Ledger.findByPk(id, {
      include: [
        { model: Income, as: "incomes" },
        { model: Expense, as: "expenses" },
        {
          model: User,
          as: "user",
          attributes: ["id", "username"],
          include: [
            {
              model: PaymentType,
              as: "paymentTypes", // 👈 make sure you defined User.hasMany(PaymentType, { as: "paymentTypes" })
            },
          ],
        },
      ],
    });
  }

  updateLedger(id, data) {
    return Ledger.update(data, { where: { id } });
  }

  getLedgerWithTransactions(id) {
    return Ledger.findByPk(id, {
      include: [
        { model: Income, as: "incomes" },
        { model: Expense, as: "expenses" },
      ],
    });
  }

  createLedger(data) {
    return Ledger.create(data);
  }

  deleteLedger(id) {
    return Ledger.destroy({ where: { id } });
  }

  // ---------------- INCOME ----------------
  bulkCreateIncome(incomes, options = {}) {
    return Income.bulkCreate(incomes, options);
  }

  addIncomeQRM(data) {
    return Income.create(data);
  }

  getIncomeById(id) {
    return Income.findByPk(id, {
      include: [{ model: PaymentType, as: "paymentType" }],
    });
  }

  updateIncome(id, data) {
    return Income.update(data, { where: { id } });
  }

  deleteIncome(id) {
    return Income.destroy({ where: { id } });
  }

  // ---------------- EXPENSE ----------------
  bulkCreateExpense(expenses, options = {}) {
    return Expense.bulkCreate(expenses, options);
  }

  addExpenseQRM(data) {
    return Expense.create(data);
  }

  getExpenseById(id) {
    return Expense.findByPk(id, {
      include: [{ model: PaymentType, as: "paymentType" }],
    });
  }

  updateExpense(id, data) {
    return Expense.update(data, { where: { id } });
  }

  deleteExpense(id) {
    return Expense.destroy({ where: { id } });
  }

  // ---------------- PAYMENT TYPE ----------------
  createPaymentType(data) {
    return PaymentType.create(data);
  }

  getAllPaymentTypes(where) {
    return PaymentType.findAll({ where });
  }

  getPaymentTypeById(id) {
    return PaymentType.findByPk(id);
  }

  async getDefaultPaymentTypeById(id) {
    const paymentType = await PaymentType.findByPk(id);

    if (!paymentType) {
      return null; // handled by controller
    }

    const isDefault = PaymentTypes.includes(paymentType.name);

    return {
      id: paymentType.id,
      name: paymentType.name,
      userId: paymentType.userId,
      createdAt: paymentType.createdAt,
      updatedAt: paymentType.updatedAt,
      isDefault,
    };
  }

  updatePaymentType(id, data) {
    return PaymentType.update(data, { where: { id } });
  }

  deletePaymentType(id) {
    return PaymentType.destroy({ where: { id } });
  }

  getPaymentTypeByName(name) {
    return PaymentType.findOne({ where: { name } });
  }

  getPaymentTypeByNameAndUser(name, userId) {
    return PaymentType.findOne({ where: { name, userId } });
  }

  isPaymentTypeInUse(id) {
    return Promise.all([
      Income.count({ where: { paymentTypeId: id } }),
      Expense.count({ where: { paymentTypeId: id } }),
    ]).then(([incomeCount, expenseCount]) => incomeCount + expenseCount > 0);
  }

  findExistingPaymentTypeIds(ids) {
    return PaymentType.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ["id"],
    }).then((rows) => rows.map((r) => r.id));
  }
}

module.exports = PaymentRepository;
