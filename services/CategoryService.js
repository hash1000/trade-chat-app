const CategoryRepository = require('../repositories/CategoryRepository');
const ListItemRepository = require('../repositories/ListRepository');

class CategoryService {
  constructor() {
    this.categoryRepository = new CategoryRepository();
    this.listItemRepository = new ListItemRepository();
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
  
  // ----------- LIST ITEMS ---------------

  async createListItem(categoryId, data) {
    return this.listItemRepository.create(categoryId, data);
  }

  async getListItems(categoryId) {
    return this.listItemRepository.findAll(categoryId);
  }

  async getListItem(categoryId, itemId) {
    return this.listItemRepository.findOne(categoryId, itemId);
  }

  async updateListItem(categoryId, itemId, data) {
    return this.listItemRepository.update(categoryId, itemId, data);
  }

  async deleteListItem(categoryId, itemId) {
    return this.listItemRepository.delete(categoryId, itemId);
  }
}

module.exports = CategoryService;
