"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("product_cart_items", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      shopProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shopProducts", key: "id" },
        onDelete: "CASCADE",
      },
      variationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "productVariations", key: "id" },
        onDelete: "CASCADE",
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      unitPriceSnapshot: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      discountCode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      discountPercent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("product_cart_items", ["userId"]);
    // Guards merge-on-duplicate for variation lines. MySQL treats NULL as distinct
    // from NULL in a unique index, so this does NOT stop duplicate rows for
    // non-variation products (variationId: null) — that case is enforced in
    // ProductCartRepository via findOne-then-update instead.
    await queryInterface.addIndex(
      "product_cart_items",
      ["userId", "shopProductId", "variationId"],
      { unique: true, name: "product_cart_items_user_product_variation_unique" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("product_cart_items");
  },
};
