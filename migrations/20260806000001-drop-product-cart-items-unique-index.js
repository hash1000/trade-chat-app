"use strict";

module.exports = {
  async up(queryInterface) {
    // Product cart lines are no longer merged on re-add (each add-to-cart call
    // creates its own line, matching the service cart's behavior), so the
    // uniqueness constraint on (userId, shopProductId, variationId) is no
    // longer valid — replaced with a plain index for lookup performance.
    await queryInterface.removeIndex(
      "product_cart_items",
      "product_cart_items_user_product_variation_unique"
    );
    await queryInterface.addIndex(
      "product_cart_items",
      ["userId", "shopProductId", "variationId"],
      { name: "product_cart_items_user_product_variation_idx" }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "product_cart_items",
      "product_cart_items_user_product_variation_idx"
    );
    await queryInterface.addIndex(
      "product_cart_items",
      ["userId", "shopProductId", "variationId"],
      { unique: true, name: "product_cart_items_user_product_variation_unique" }
    );
  },
};
