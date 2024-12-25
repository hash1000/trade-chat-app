'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tags = [
      { name: "#tag1", createdAt: new Date(), updatedAt: new Date() },
      { name: "#tag2", createdAt: new Date(), updatedAt: new Date() },
    ];
    await queryInterface.bulkInsert('tags', tags, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('tags', null, {});
  }
};
