const db = require("../config/database");
const User = require("./user");
const Order = require("./order");
const Document = require("./document");
const Address = require("./address");
const Role = require("./role");

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
  foreignKey: "userId",
  as: "orders"
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

// In your associations setup (e.g., in a separate file or where you define relationships)

// User has many Orders as a regular user (userId)
User.hasMany(Order, {
  foreignKey: "userId",
  as: "userOrders"
});

// Order belongs to User (userId) as 'user'
Order.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

// User has many Orders as an admin (adminId)
User.hasMany(Order, {
  foreignKey: "adminId",
  as: "adminOrders"
});

// Order belongs to User (adminId) as 'hashir'
Order.belongsTo(User, {
  foreignKey: "adminId",
  as: "admin"
});


// many to many user::role
User.belongsToMany(Role, { through: 'User_Roles' });
Role.belongsToMany(User, { through: 'User_Roles' });


module.exports = {
  db,
  User,
  Role,
  Order,
  Document,
};
