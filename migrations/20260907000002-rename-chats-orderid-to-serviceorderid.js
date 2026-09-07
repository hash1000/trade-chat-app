"use strict";

// chats.orderId -> chats.serviceOrderId. Renamed before this ever shipped
// widely: product/shop orders (ProductOrder/ProductShopOrder) live in
// entirely separate tables (product_orders, product_shop_orders) with their
// own independent id spaces, not `orders` — a bare "orderId" here is
// ambiguous the moment a product- or shop-order chat feature exists, since
// each of those will need (and get) its own, differently-named column
// rather than reusing this one. See models/chat.js and
// ChatService.createOrGetServiceOrderChat.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.renameColumn("chats", "orderId", "serviceOrderId");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.renameColumn("chats", "serviceOrderId", "orderId");
  },
};
