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
const UserRepository = require("../repositories/UserRepository");
const userRepository = new UserRepository();

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

  async transferAmount(userId, adjustedAmount, amount) {
    const user = await userRepository.getById(userId);
    // check balance
    if (user.usdWalletBalance < adjustedAmount) {
      throw new Error("Insufficient funds");
    }
    // now transfer balnce to personalWalletBalance
    const updateBalance = await userRepository.update(userId, {
      personalWalletBalance: user.personalWalletBalance + amount,
      usdWalletBalance: user.usdWalletBalance - adjustedAmount
    });
    return updateBalance;
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

  async createPaymentRequest(
    requesterId,
    requesteeId,
    amount,
    description,
    status,
  ) {
    const paymentRequest = await PaymentRequest.create({
      requesterId,
      requesteeId,
      amount,
      description,
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
  async addLedger(data, options = {}) {
    const maxSequence = await Ledger.max("sequence", {
      where: { userId: data.userId },
      transaction: options.transaction,
    });

    return Ledger.create(
      {
        ...data,
        sequence: (maxSequence || 0) + 1,
      },
      options,
    );
  }

  getLedgersByUser(userId, archived = false) {
    return Ledger.findAll({
      where: {
        userId,
        archived,
      },
      order: [["sequence", "ASC"]],
      include: [
        {
          model: Income,
          as: "incomes",
          separate: true,
          include: [{ model: PaymentType, as: "paymentType" }],
          order: [["sequence", "ASC"]], // Order incomes by sequence in ascending order
        },
        {
          model: Expense,
          as: "expenses",
          separate: true,
          include: [{ model: PaymentType, as: "paymentType" }],
          order: [["sequence", "ASC"]], // Order expenses by sequence in ascending order
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
    console.log("Getting ledger by ID:", id);
    return Ledger.findByPk(id, {
      include: [
        {
          model: Income,
          as: "incomes",
          separate: true,
          order: [["sequence", "ASC"]], // Order incomes by sequence in ascending order
          include: [{ model: PaymentType, as: "paymentType" }],
        },
        {
          model: Expense,
          as: "expenses",
          separate: true,
          order: [["sequence", "ASC"]], // Order expenses by sequence in ascending order
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

  updateLedger(id, data) {
    return Ledger.update(data, { where: { id } });
  }

  async reorderLedger(userId, ledgerId, newPosition) {
    const transaction = await Ledger.sequelize.transaction();

    try {
      const ledgerToMove = await Ledger.findOne({
        where: { id: ledgerId, userId },
        transaction,
      });

      if (!ledgerToMove) {
        await transaction.rollback();
        return null;
      }

      const currentPosition = ledgerToMove.sequence;

      if (currentPosition === newPosition) {
        await transaction.commit();
        return this.getLedgersByUser(userId);
      }

      if (newPosition < currentPosition) {
        await Ledger.update(
          { sequence: Ledger.sequelize.literal("sequence + 1") },
          {
            where: {
              userId,
              sequence: { [Op.between]: [newPosition, currentPosition - 1] },
            },
            transaction,
          },
        );
      } else {
        await Ledger.update(
          { sequence: Ledger.sequelize.literal("sequence - 1") },
          {
            where: {
              userId,
              sequence: { [Op.between]: [currentPosition + 1, newPosition] },
            },
            transaction,
          },
        );
      }

      await ledgerToMove.update({ sequence: newPosition }, { transaction });
      await transaction.commit();

      return this.getLedgersByUser(userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  getLedgerWithTransactions(id) {
    console.log("Getting ledger with transactions by ID:", id);
    return Ledger.findByPk(id, {
      include: [
        {
          model: Income,
          as: "incomes",
          separate: true,
          order: [["sequence", "ASC"]],
        },
        {
          model: Expense,
          as: "expenses",
          separate: true,
          order: [["sequence", "ASC"]],
        },
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

  async bulkCreateIncome(incomes, options = {}) {
    // Get the maximum sequence for the ledgerIds in the incoming data
    const ledgerIds = [...new Set(incomes.map((income) => income.ledgerId))]; // Extract unique ledgerIds
    const maxSequences = await Promise.all(
      ledgerIds.map(async (ledgerId) => {
        const maxSequence = await Income.max("sequence", {
          where: { ledgerId },
          transaction: options.transaction,
        });
        return { ledgerId, maxSequence: maxSequence || 0 }; // Default to 0 if no sequence exists
      }),
    );

    // Add sequence to each income based on its ledgerId
    const incomesWithSequence = incomes.map((income) => {
      const maxSequence = maxSequences.find(
        (seq) => seq.ledgerId === income.ledgerId,
      );
      return {
        ...income,
        sequence: (maxSequence ? maxSequence.maxSequence : 0) + 1, // Increment sequence for this ledgerId
      };
    });

    // Perform bulk create with the updated incomes
    return Income.bulkCreate(incomesWithSequence, options);
  }

  async addIncomeQRM(data) {
    const maxSequence = await Income.max("sequence", {
      where: { ledgerId: data.ledgerId },
    });
    return Income.create({
      ...data,
      sequence: (maxSequence || 0) + 1,
    });
  }

  getIncomeById(id) {
    return Income.findByPk(id, {
      include: [{ model: PaymentType, as: "paymentType" }],
    });
  }

  getIncomeByLedgerId(ledgerId) {
    return Income.findAll({
      where: {
        ledgerId: ledgerId,
      },
      include: [{ model: PaymentType, as: "paymentType" }],
    });
  }

  updateIncome(id, data) {
    console.log("Updating income ID:", id, "with data:", data);
    return Income.update(data, { where: { id } });
  }

  deleteIncome(id) {
    return Income.destroy({ where: { id } });
  }

  async reorderIncome(incomeId, newPosition) {
    const transaction = await Income.sequelize.transaction();

    try {
      const incomeToMove = await Income.findOne({
        where: { id: incomeId },
        transaction,
      });

      if (!incomeToMove) {
        await transaction.rollback();
        return null;
      }

      const currentPosition = incomeToMove.sequence;

      if (currentPosition === newPosition) {
        await transaction.commit();
        return this.getIncomeById(incomeId);
      }
      if (newPosition < currentPosition) {
        await Income.update(
          { sequence: Income.sequelize.literal("sequence + 1") },
          {
            where: {
              sequence: { [Op.between]: [newPosition, currentPosition - 1] },
            },
            transaction,
          },
        );
      } else {
        await Income.update(
          { sequence: Income.sequelize.literal("sequence - 1") },
          {
            where: {
              sequence: { [Op.between]: [currentPosition + 1, newPosition] },
            },
            transaction,
          },
        );
      }

      await incomeToMove.update({ sequence: newPosition }, { transaction });
      await transaction.commit();

      return this.getIncomeById(incomeId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ---------------- EXPENSE ----------------
  async bulkCreateExpense(expenses, options = {}) {
    const ledgerIds = [...new Set(expenses.map((e) => e.ledgerId))];

    const maxSequences = await Promise.all(
      ledgerIds.map(async (ledgerId) => {
        const maxSequence = await Expense.max("sequence", {
          where: { ledgerId },
          transaction: options.transaction,
        });
        return { ledgerId, maxSequence: maxSequence || 0 };
      }),
    );

    const expensesWithSequence = expenses.map((expense) => {
      const seq = maxSequences.find((s) => s.ledgerId === expense.ledgerId);
      return {
        ...expense,
        sequence: (seq?.maxSequence || 0) + 1,
      };
    });

    return Expense.bulkCreate(expensesWithSequence, options);
  }

  async addExpenseQRM(data) {
    const maxSequence = await Expense.max("sequence", {
      where: { ledgerId: data.ledgerId },
    });

    return Expense.create({
      ...data,
      sequence: (maxSequence || 0) + 1,
    });
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

  async reorderExpense(expenseId, newPosition) {
    const transaction = await Expense.sequelize.transaction();

    try {
      const expenseToMove = await Expense.findOne({
        where: { id: expenseId },
        transaction,
      });

      if (!expenseToMove) {
        await transaction.rollback();
        return null;
      }

      const { ledgerId, sequence: currentPosition } = expenseToMove;

      if (currentPosition === newPosition) {
        await transaction.commit();
        return this.getExpenseById(expenseId);
      }

      if (newPosition < currentPosition) {
        await Expense.update(
          { sequence: Expense.sequelize.literal("sequence + 1") },
          {
            where: {
              ledgerId,
              sequence: { [Op.between]: [newPosition, currentPosition - 1] },
            },
            transaction,
          },
        );
      } else {
        await Expense.update(
          { sequence: Expense.sequelize.literal("sequence - 1") },
          {
            where: {
              ledgerId,
              sequence: { [Op.between]: [currentPosition + 1, newPosition] },
            },
            transaction,
          },
        );
      }

      await expenseToMove.update({ sequence: newPosition }, { transaction });
      await transaction.commit();

      return this.getExpenseById(expenseId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
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

  getPaymentTypeByUserId(userId) {
    return PaymentType.findAll({ where: { userId } });
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
      pin: paymentType.pin,
      userId: paymentType.userId,
      createdAt: paymentType.createdAt,
      updatedAt: paymentType.updatedAt,
      isDefault,
    };
  }

  updatePaymentType(id, data) {
    return PaymentType.update(data, { where: { id } });
  }

  async unpinAllPaymentTypes(userId, excludeId) {
    await PaymentType.update(
      { pin: true },
      {
        where: {
          userId: userId,
          id: excludeId,
        },
      },
    );

    return PaymentType.update(
      { pin: false },
      {
        where: {
          userId: userId,
          id: {
            [Op.ne]: excludeId, // exclude current record
          },
        },
      },
    );
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
