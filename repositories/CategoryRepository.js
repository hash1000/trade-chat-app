const Category = require('../models/category');
const ShortList = require('../models/shortList');

class CategoryRepository {
  async findAll(userId) {
    return await Category.findAll({
      where: { userId },
      include: [
        {
          model: ShortList,
          as: "shortList",
        },
      ],
      order: [['sequence', 'ASC']],
    });
  }

  async getCategoryById(userId, categoryId) {
    return await Category.findOne({
      where: { id: categoryId, userId },
    });
  }

    async findById(id, userId) {
    return await Category.findOne({
      where: { id, userId }
    });
  }

  // Find all categories for a user
  async findAll(userId) {
    return await Category.findAll({
      where: { userId }
    });
  }

  // Find category by title
  async findByTitle(userId, title) {
    console.log("userId, title, findByTitle",userId, title);
    return await Category.findOne({
      where: { userId, title }
    });
  }

   // Delete category by userId and categoryId
  async deleteCategory(id, userId) {
    const result = await Category.destroy({
      where: { id, userId }
    });

    return result > 0;  // Returns true if deletion was successful
  }

  async createCategory(userId, title) {
    console.log('Creating category for userId:', userId, 'with data:', title);
    return await Category.create({
      userId,
      title
    });
  }

  async updateCategory(id, userId, title) {
    return await Category.update(
      { title },
      { where: { id, userId } }
    );
  }


}

module.exports = CategoryRepository;
