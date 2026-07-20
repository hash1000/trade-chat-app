"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.renameColumn("product_cart_items", "quantity", "productCartItemQuantity");
  },

  async down(queryInterface) {
    await queryInterface.renameColumn("product_cart_items", "productCartItemQuantity", "quantity");
  },
};
