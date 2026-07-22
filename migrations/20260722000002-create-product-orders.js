"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("product_orders", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      orderNo: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      addressId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "address", key: "id" },
        onDelete: "SET NULL",
      },
      deliveryType: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      walletType: {
        type: Sequelize.ENUM("PERSONAL", "COMPANY"),
        allowNull: false,
      },
      totalAmount: {
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

    await queryInterface.addIndex("product_orders", ["userId"]);

    await queryInterface.createTable("product_shop_orders", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      orderNo: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      parentOrderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "product_orders", key: "id" },
        onDelete: "CASCADE",
      },
      shopId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shops", key: "id" },
        onDelete: "RESTRICT",
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.ENUM(
          "confirmed",
          "processing",
          "shipped",
          "in_transit",
          "customs",
          "out_for_delivery",
          "delivered",
          "cancelled",
          "refunded",
          "returned"
        ),
        allowNull: false,
        defaultValue: "confirmed",
      },
      subtotal: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      addOnAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      chargesAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      paidAmount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
        defaultValue: 0,
      },
      payoutWalletId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "wallets", key: "id" },
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("product_shop_orders", ["parentOrderId"]);
    await queryInterface.addIndex("product_shop_orders", ["shopId"]);
    await queryInterface.addIndex("product_shop_orders", ["userId"]);
    await queryInterface.addIndex("product_shop_orders", ["status"]);

    await queryInterface.createTable("product_shop_order_items", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      shopOrderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "product_shop_orders", key: "id" },
        onDelete: "CASCADE",
      },
      shopProductId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "shopProducts", key: "id" },
        onDelete: "RESTRICT",
      },
      variationId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "productVariations", key: "id" },
        onDelete: "RESTRICT",
      },
      productCartItemQuantity: {
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
      addOns: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: [],
      },
      subtotal: {
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

    await queryInterface.addIndex("product_shop_order_items", ["shopOrderId"]);

    await queryInterface.createTable("product_shop_order_charges", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      shopOrderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "product_shop_orders", key: "id" },
        onDelete: "CASCADE",
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false,
      },
      addedBy: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "CASCADE",
      },
      isPaid: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      paidAt: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("product_shop_order_charges", ["shopOrderId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("product_shop_order_charges");
    await queryInterface.dropTable("product_shop_order_items");
    await queryInterface.dropTable("product_shop_orders");
    await queryInterface.dropTable("product_orders");
  },
};
