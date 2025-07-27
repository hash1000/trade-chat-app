const db = require("../config/database");

// Import all models
const User = require("./user");
const Order = require("./order");
const Address = require("./address");
const Document = require("./document");
const Role = require("./role");
const UserRole = require("./userRole");
const Permission = require("./permission");
const Transaction = require("./transaction");
const BalanceSheet = require("./balanceSheet");
const Ledger = require("./ledger");
const Income = require("./ledgerIncome");
const Expense = require("./ledgerExpense");
const PaymentType = require("./paymentType"); // Make sure to import PaymentType

// Define all associations
function defineAssociations() {
  // User associations
  User.hasMany(Address, { foreignKey: "userId", as: "addresses" });
  Address.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Order, { foreignKey: "userId", as: "orders" });
  Order.belongsTo(User, { foreignKey: "userId", as: "user" });

  User.hasMany(Order, { foreignKey: "creatorId", as: "createdOrders" });
  Order.belongsTo(User, { foreignKey: "creatorId", as: "creator" });

  // Order-Document associations
  Order.hasMany(Document, {
    foreignKey: "orderNo",
    sourceKey: "orderNo",
    as: "documents",
  });
  Document.belongsTo(Order, {
    foreignKey: "orderNo",
    targetKey: "orderNo",
    as: "order",
  });

  // Address-Order association
  Address.hasMany(Order, { foreignKey: "addressId", as: "orders" });
  Order.belongsTo(Address, { foreignKey: "addressId", as: "address" });

  // User-Role many-to-many
  User.belongsToMany(Role, {
    through: UserRole,
    foreignKey: "userId",
    as: "roles",
  });
  Role.belongsToMany(User, {
    through: UserRole,
    foreignKey: "roleId",
    as: "users",
  });

  // Transaction associations
  User.hasMany(Transaction, { foreignKey: "userId", as: "transactions" });
  Transaction.belongsTo(User, { foreignKey: "userId", as: "user" });

  Order.hasMany(Transaction, { foreignKey: "orderId", as: "transactions" });
  Transaction.belongsTo(Order, { foreignKey: "orderId", as: "order" });

  // Balance Sheet associations
  User.hasMany(BalanceSheet, { foreignKey: "userId", as: "balanceSheets" });
  BalanceSheet.belongsTo(User, { foreignKey: "userId", as: "user" });

  BalanceSheet.hasMany(Ledger, {
    foreignKey: "balanceSheetId",
    as: "ledgers",
  });
  Ledger.belongsTo(BalanceSheet, {
    foreignKey: "balanceSheetId",
    as: "balanceSheet",
  });

  // Ledger associations
  Ledger.hasMany(Income, {
    foreignKey: "ledgerId",
    as: "incomes",
  });
  Income.belongsTo(Ledger, {
    foreignKey: "ledgerId",
    as: "ledger",
  });

  Ledger.hasMany(Expense, {
    foreignKey: "ledgerId",
    as: "expenses",
  });
  Expense.belongsTo(Ledger, {
    foreignKey: "ledgerId",
    as: "ledger",
  });

  // Payment Type associations
  PaymentType.belongsTo(User, { foreignKey: "userId", as: "user" });
  User.hasMany(PaymentType, { foreignKey: "userId", as: "paymentTypes" });

  Income.belongsTo(PaymentType, { foreignKey: "paymentTypeId", as: "paymentType" });
  Expense.belongsTo(PaymentType, { foreignKey: "paymentTypeId", as: "paymentType" });
}

// Initialize associations
defineAssociations();

// Export models
module.exports = {
  db,
  User,
  Role,
  UserRole,
  Order,
  Address,
  Document,
  Permission,
  Transaction,
  BalanceSheet,
  Ledger,
  Income,
  Expense,
  PaymentType,
};