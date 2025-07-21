const db = require("../config/database");

const User = require("./user");
const Order = require("./order");
const Address = require("./address");
const Document = require("./document");
const Role = require("./role");
const UserRole = require("./userRole");
const Permission = require("./permission"); // Add this line
const Transaction = require("./transaction");
const BalanceSheet = require("./balanceSheet");
const Ledger = require("./ledger");
const Income = require("./ledgerIncome");
const Expense = require("./ledgerExpense");

// Define associations here
User.hasMany(Address, { foreignKey: "userId", as: "addresses" });
Address.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Order, { foreignKey: "userId", as: "order" });
Order.belongsTo(User, { foreignKey: "userId", as: "users" });

User.hasMany(Order, { foreignKey: "creatorId", as: "creatorOrders" });
Order.belongsTo(User, { foreignKey: "creatorId", as: "creator" });

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

Address.hasOne(Order, { foreignKey: "addressId", as: "order" });
Order.belongsTo(Address, { foreignKey: "addressId", as: "address" });

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

// User - Transaction
User.hasMany(Transaction, { foreignKey: "userId", as: "transactions" });
Transaction.belongsTo(User, { foreignKey: "userId", as: "user" });

// Order - Transaction
Order.hasMany(Transaction, { foreignKey: "orderId", as: "transactions" });
Transaction.belongsTo(Order, { foreignKey: "orderId", as: "order" });
// BalanceSheet - Ledger (One-to-Many)
BalanceSheet.hasMany(Ledger, {
  foreignKey: "balanceSheetId",
  as: "ledgers",
});
Ledger.belongsTo(BalanceSheet, {
  foreignKey: "balanceSheetId",
  as: "balanceSheet",
});

// Ledger - Income (One-to-Many)
Ledger.hasMany(Income, {
  foreignKey: "ledgerId",
  as: "incomes",
});
Income.belongsTo(Ledger, {
  foreignKey: "ledgerId",
  as: "ledger",
});

// Ledger - Expense (One-to-Many)
Ledger.hasMany(Expense, {
  foreignKey: "ledgerId",
  as: "expenses",
});
Expense.belongsTo(Ledger, {
  foreignKey: "ledgerId",
  as: "ledger",
});

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
};
