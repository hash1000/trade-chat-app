const PublicCategory = require("../models/publicCategories");

class PublicCategoryRepository {
  async getCategoryById(categoryId) {
    return await PublicCategory.findOne({
      where: { id: categoryId },
    });
  }

  async findById(id) {
    return await PublicCategory.findOne({
      where: { id },
    });
  }

  async findOne(id) {
    return await PublicCategory.findOne({
      where: { id },
    });
  }

  async findAll(filters = {}) {
    const where = {};
    if (filters.type !== undefined) {
      where.type = filters.type;
    }

    return await PublicCategory.findAll({
      where,
      order: [["createdAt", "DESC"]],
    });
  }

  // Find category by title
  async findByTitle(title, type) {
    const where = { title };
    if (type !== undefined) {
      where.type = type;
    }

    return await PublicCategory.findOne({
      where
    });
  }

  // Delete category by and categoryId
  async deleteCategory(id) {
    const result = await PublicCategory.destroy({
      where: { id },
    });

    return result > 0; // Returns true if deletion was successful
  }

  async createCategory(title, type) {
    return await PublicCategory.create({
      title,
      type,
    });
  }

  async updateCategory(id, data) {
    return await PublicCategory.update(data, { where: { id } });
  }

  async exists(categoryId) {
    const category = await PublicCategory.findOne({
      where: { id: categoryId },
    });
    return !!category; // Returns true if category exists, otherwise false
  }
}

module.exports = PublicCategoryRepository;
