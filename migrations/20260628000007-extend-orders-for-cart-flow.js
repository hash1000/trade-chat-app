"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Extend status enum to include  PENDING_PAYMENT
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED','PENDING_PAYMENT') NOT NULL DEFAULT 'WAITING'`
    );

    // Add cartId column (nullable — legacy orders have no cart)
    await queryInterface.addColumn("orders", "cartId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "carts", key: "id" },
      onDelete: "SET NULL",
      after: "userId",
    }).catch(() => {}); // ignore if already exists

    // Add deliveryOption column
    await queryInterface.addColumn("orders", "deliveryOption", {
      type: Sequelize.ENUM("standard", "express", "overnight"),
      allowNull: true,
      after: "addressId",
    }).catch(() => {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("orders", "deliveryOption").catch(() => {});
    await queryInterface.removeColumn("orders", "cartId").catch(() => {});
    await queryInterface.sequelize.query(
      `ALTER TABLE orders MODIFY COLUMN status ENUM('WAITING','PAYED','SHIPPED') NOT NULL DEFAULT 'WAITING'`
    );
  },
};
