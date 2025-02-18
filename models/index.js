const db = require("../config/database");
const User = require("./user");
const Order = require("./order");
const Document = require("./document");
const Address = require("./address");

// Define associations here
Order.hasMany(Document, {
  foreignKey: "orderNo", // Foreign key in Document
  sourceKey: "orderNo", // Matching field in Order
  as: "documents", //
});
Document.belongsTo(Order, {
  foreignKey: "orderNo", // Foreign key in Document
  targetKey: "orderNo", // Matching field in Order
  as: "order",
});

User.hasMany(Order, {
  foreignKey: "id",
  as: "order"
});

Order.belongsTo(User, {
  foreignKey: "userId",
  targetKey: "id",
  as: "users"
});

// Define associations
User.hasMany(Address, { foreignKey: "userId", as: "address" });
Address.belongsTo(User, { foreignKey: "userId", as: "users" });


Address.hasOne(Order, { foreignKey: "addressId", as: "orders" });
Order.belongsTo(Address, { foreignKey: "addressId", as: "address" });

module.exports = {
  db,
  User,
  Order,
  Document,
};
