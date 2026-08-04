"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeIndex("cart_items", ["cartId", "serviceId"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addIndex("cart_items", ["cartId", "serviceId"], { unique: true });
  },
};
