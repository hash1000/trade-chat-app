"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {

    // 2️⃣ Add composite unique constraint (userId + title)
    await queryInterface.addConstraint("categories", {
      fields: ["userId", "title"],
      type: "unique",
      name: "unique_user_category_title",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('categories', 'title', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true,
    });


  },
};
