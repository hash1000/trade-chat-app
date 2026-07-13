"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const pk = { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER };
    const timestamps = {
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    };

    // ── Variations (full mock shape: dual availability modes) ───────────────
    await queryInterface.createTable("productVariations", {
      id: pk,
      shopProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shopProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: { type: Sequelize.STRING, allowNull: false },
      sizeSpec: { type: Sequelize.STRING, allowNull: true },
      unit: {
        type: Sequelize.ENUM("per_piece", "per_unit", "per_m3", "per_m2", "per_carton", "per_ton"),
        allowNull: false,
        defaultValue: "per_piece",
      },
      price: { type: Sequelize.FLOAT, allowNull: false },
      inStock: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      stock: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      stockMinOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      byOrder: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      byOrderMinOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      leadTime: { type: Sequelize.STRING, allowNull: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addIndex("productVariations", ["shopProductId"]);

    // ── Per-variation images ─────────────────────────────────────────────────
    await queryInterface.createTable("productVariationImages", {
      id: pk,
      productVariationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "productVariations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      url: { type: Sequelize.STRING, allowNull: false },
      ...timestamps,
    });

    // ── Automatic quantity discount rules ("Buy 3+ → -5%") ──────────────────
    await queryInterface.createTable("productDiscounts", {
      id: pk,
      shopProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shopProducts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      name: { type: Sequelize.STRING, allowNull: false },
      minQuantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      discountPercent: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addIndex("productDiscounts", ["shopProductId"]);

    // ── Manual codes: usage limits instead of single-use ────────────────────
    await queryInterface.addColumn("product_discount_codes", "usageLimit", {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("product_discount_codes", "usedCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("product_discount_codes", "usedCount");
    await queryInterface.removeColumn("product_discount_codes", "usageLimit");
    await queryInterface.dropTable("productDiscounts");
    await queryInterface.dropTable("productVariationImages");
    await queryInterface.dropTable("productVariations");
  },
};
