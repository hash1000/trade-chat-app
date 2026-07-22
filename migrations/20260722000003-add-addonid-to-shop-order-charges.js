"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("product_shop_order_charges", "addOnId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "product_add_ons", key: "id" },
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("product_shop_order_charges", ["addOnId"]);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("product_shop_order_charges", "addOnId");
  },
};
