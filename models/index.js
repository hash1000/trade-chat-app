const sequelize = require("../config/database");

// Import model definitions (as functions)
const User = require("./user");
const Order = require("./order");
const Address = require("./address");
const Document = require("./document");

// Initialize models
const models = {
  User: User(sequelize),
  Order: Order(sequelize),
  Address: Address(sequelize),
  Document: Document(sequelize),
};

// Set up associations
Object.values(models).forEach((model) => {
  if (model.associate) {
    model.associate(models);
  }
});

module.exports = {
  ...models,
  sequelize,
};
