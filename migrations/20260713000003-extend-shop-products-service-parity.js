"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ── Extend shopProducts with service-style fields ──────────────────────
    await queryInterface.addColumn("shopProducts", "description", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("shopProducts", "pricing_type", {
      type: Sequelize.ENUM("free", "fixed", "range"),
      allowNull: false,
      defaultValue: "fixed",
    });
    await queryInterface.addColumn("shopProducts", "min_price", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: true,
    });
    await queryInterface.addColumn("shopProducts", "max_price", {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: true,
    });
    await queryInterface.addColumn("shopProducts", "tags", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    for (const col of ["insured", "moneyBack", "support247", "isTopChoice", "isQRMVerified"]) {
      await queryInterface.addColumn("shopProducts", col, {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    await queryInterface.addColumn("shopProducts", "ratingAvg", {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("shopProducts", "ratingCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("shopProducts", "baseViewCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn("shopProducts", "baseLikeCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    const fk = (table, col, refTable, onDelete = "CASCADE") => ({
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: refTable, key: "id" },
      onUpdate: "CASCADE",
      onDelete,
    });
    const timestamps = {
      createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updatedAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    };
    const pk = { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER };

    // ── Likes ───────────────────────────────────────────────────────────────
    await queryInterface.createTable("product_likes", {
      id: pk,
      userId: fk("product_likes", "userId", "users"),
      shopProductId: fk("product_likes", "shopProductId", "shopProducts"),
      ...timestamps,
    });
    await queryInterface.addIndex("product_likes", ["userId", "shopProductId"], {
      unique: true,
      name: "product_likes_user_product_unique",
    });

    // ── Ratings (per-user, 0-10) ────────────────────────────────────────────
    await queryInterface.createTable("product_ratings", {
      id: pk,
      shopProductId: fk("product_ratings", "shopProductId", "shopProducts"),
      userId: fk("product_ratings", "userId", "users"),
      rating: { type: Sequelize.INTEGER, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex("product_ratings", ["shopProductId", "userId"], {
      unique: true,
      name: "product_ratings_product_user_unique",
    });

    // ── Views ───────────────────────────────────────────────────────────────
    await queryInterface.createTable("product_views", {
      id: pk,
      userId: fk("product_views", "userId", "users"),
      shopProductId: fk("product_views", "shopProductId", "shopProducts"),
      ...timestamps,
    });
    await queryInterface.addIndex("product_views", ["userId", "shopProductId"], {
      unique: true,
      name: "product_views_user_product_unique",
    });

    // ── Media files ─────────────────────────────────────────────────────────
    await queryInterface.createTable("product_files", {
      id: pk,
      shopProductId: fk("product_files", "shopProductId", "shopProducts"),
      file_url: { type: Sequelize.STRING, allowNull: false },
      file_name: { type: Sequelize.STRING, allowNull: false },
      file_type: {
        type: Sequelize.ENUM("video", "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "image", "other"),
        allowNull: false,
      },
      s3_key: { type: Sequelize.STRING, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });

    // ── Discount codes ──────────────────────────────────────────────────────
    await queryInterface.createTable("product_discount_codes", {
      id: pk,
      shopProductId: fk("product_discount_codes", "shopProductId", "shopProducts"),
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      discountPercentage: { type: Sequelize.DECIMAL(5, 2), allowNull: false },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      isUsed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      usedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      usedAt: { type: Sequelize.DATE, allowNull: true },
      expiryDate: { type: Sequelize.DATE, allowNull: true },
      createdBy: fk("product_discount_codes", "createdBy", "users"),
      ...timestamps,
    });
    await queryInterface.addIndex("product_discount_codes", ["shopProductId"]);
    await queryInterface.addIndex("product_discount_codes", ["shopProductId", "isUsed"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("product_discount_codes");
    await queryInterface.dropTable("product_files");
    await queryInterface.dropTable("product_views");
    await queryInterface.dropTable("product_ratings");
    await queryInterface.dropTable("product_likes");
    for (const col of [
      "description", "pricing_type", "min_price", "max_price", "tags",
      "insured", "moneyBack", "support247", "isTopChoice", "isQRMVerified",
      "ratingAvg", "ratingCount", "baseViewCount", "baseLikeCount",
    ]) {
      await queryInterface.removeColumn("shopProducts", col);
    }
  },
};
