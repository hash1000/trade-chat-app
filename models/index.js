const db = require("../config/database");

const User = require("./user");
const Order = require("./order");
const Address = require("./address");
const Document = require("./document");

// Define associations here
User.hasMany(Address, { foreignKey: "userId", as: "addresses" });
Address.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Order, { foreignKey: "userId", as: "userOrders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Order, { foreignKey: "adminId", as: "adminOrders" });
Order.belongsTo(User, { foreignKey: "adminId", as: "admin" });

Order.hasMany(Document, { foreignKey: "orderNo", sourceKey: "orderNo", as: "documents" });
Document.belongsTo(Order, { foreignKey: "orderNo", targetKey: "orderNo", as: "order" });

Address.hasOne(Order, { foreignKey: "addressId", as: "order" });
Order.belongsTo(Address, { foreignKey: "addressId", as: "address" });

// Export models
module.exports = { db, User, Order, Address, Document };
