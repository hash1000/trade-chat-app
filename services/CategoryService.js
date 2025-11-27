const CategoryRepository = require('../repositories/CategoryRepository');

class CategoryService {
  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  async getCategoriesByUserId(userId) {
    return this.categoryRepository.getCategoriesByUserId(userId);
  }

  async getCategoryById(userId, categoryId) {
    return this.categoryRepository.getCategoryById(userId, categoryId);
  }

  async createCategory(userId, data) {
    return this.categoryRepository.createCategory(userId, data);
  }

  async updateCategory(userId, categoryId, updateData) {
    return this.categoryRepository.updateCategory(userId, categoryId, updateData);
  }

  async deleteCategory(userId, categoryId) {
    return this.categoryRepository.deleteCategory(userId, categoryId);
  }

  async reorderCategory(userId, categoryId, newPosition) {
    return this.categoryRepository.reorderCategory(userId, categoryId, newPosition);
  }
}

module.exports = CategoryService;
