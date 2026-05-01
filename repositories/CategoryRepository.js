const Category = require("../models/categories");

class CategoryRepository {
  async getCategoryById(userId, categoryId) {
    return await Category.findOne({
      where: { id: categoryId, userId },
    });
  }

  async findById(id, userId) {
    return await Category.findOne({
      where: { id, userId },
    });
  }

  async findOne(id) {
    return await Category.findOne({
      where: { id },
    });
  }

  async findAll(userId, filters = {}) {
    const where = { userId };
    if (filters.type !== undefined) {
      where.type = filters.type;
    }

    return await Category.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });
  }

  // Find category by title
  async findByTitle(userId, title, type) {
    const where = { userId, title };
    if (type !== undefined) {
      where.type = type;
    }

    return await Category.findOne({
      where,
    });
  }

  // Delete category by userId and categoryId
  async deleteCategory(id, userId) {
    const result = await Category.destroy({
      where: { id, userId },
    });

    return result > 0; // Returns true if deletion was successful
  }

  async createCategory(userId, title, type) {
    return await Category.create({
      userId,
      title,
      type,
    });
  }

  // ➤ GET SINGLE ITEM
  // Find currently pinned category for user
  async findPinned(userId) {
    return await Category.findOne({
      where: { userId, pin: 1 },
    });
  }

  async updateCategory(id, userId, data) {
    return await Category.update(data, { where: { id, userId } });
  }

  async exists(categoryId) {
    const category = await Category.findOne({
      where: { id: categoryId },
    });
    return !!category; // Returns true if category exists, otherwise false
  }
}

module.exports = CategoryRepository;
