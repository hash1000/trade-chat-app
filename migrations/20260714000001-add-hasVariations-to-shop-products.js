"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("shopProducts", "hasVariations", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // products that already carry variations are variation-based by definition
    await queryInterface.sequelize.query(`
      UPDATE shopProducts
      SET hasVariations = true
      WHERE id IN (SELECT DISTINCT shopProductId FROM productVariations)
    `);

    // and their price must now be derived from those variations
    await queryInterface.sequelize.query(`
      UPDATE shopProducts p
      JOIN (
        SELECT shopProductId, COUNT(*) AS n, MIN(price) AS lo, MAX(price) AS hi
        FROM productVariations
        GROUP BY shopProductId
      ) v ON v.shopProductId = p.id
      SET p.pricing_type = IF(v.n = 1, 'fixed', 'range'),
          p.price        = IF(v.n = 1, v.lo, 0),
          p.min_price    = IF(v.n = 1, NULL, v.lo),
          p.max_price    = IF(v.n = 1, NULL, v.hi)
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn("shopProducts", "hasVariations");
  },
};
