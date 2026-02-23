"use strict";

const { CategoryTypes } = require("../constants");

module.exports = {
  async up(queryInterface, Sequelize) {
    const [users] = await queryInterface.sequelize.query(`
      SELECT id FROM users
    `);
    
    console.log("users", users);
    
    for (const user of users) {
      // Check if user already has payment types
      const [existingPaymentTypes] = await queryInterface.sequelize.query(
        `SELECT id FROM payment_types WHERE userId = :userId`,
        { replacements: { userId: user.id } }
      );

      console.log("existingPaymentTypes", existingPaymentTypes);  
      
      if (existingPaymentTypes.length > 0) {
        // Check which categories already exist for this user
        const [existingCategories] = await queryInterface.sequelize.query(
          `SELECT title FROM categories WHERE userId = :userId AND title IN (:categoryTitles)`,
          { 
            replacements: { 
              userId: user.id,
              categoryTitles: CategoryTypes
            } 
          }
        );

        // Extract existing titles for this user
        const existingTitles = existingCategories.map(cat => cat.title);
        
        // Filter to get only new categories
        const newRecords = CategoryTypes
          .filter(type => !existingTitles.includes(type))
          .map(type => ({
            title: type,
            userId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
        
        console.log("newRecords for user", user.id, newRecords);
        
        // Only insert if there are new records
        if (newRecords.length > 0) {
          await queryInterface.bulkInsert("categories", newRecords);
        } else {
          console.log(`All categories already exist for user ${user.id}, skipping insertion.`);
        }
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("categories", null, {});
  },
};