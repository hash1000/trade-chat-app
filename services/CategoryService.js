const CategoryRepository = require('../repositories/CategoryRepository');
const ListItemRepository = require('../repositories/ListRepository');

class CategoryService {
  constructor() {
    this.categoryRepository = new CategoryRepository();
    this.listItemRepository = new ListItemRepository();
  }

  // ===========================================
  //                 CATEGORY
  // ===========================================

  async getCategoriesByUserId(userId) {
    if (!userId) throw new Error("User ID is required");

    const categories = await this.categoryRepository.getCategoriesByUserId(userId);
    return categories || [];
  }

  async getCategoryById(userId, categoryId) {
    if (!userId || !categoryId) return null;

    return await this.categoryRepository.getCategoryById(userId, categoryId);
  }

  async createCategory(userId, data) {
    if (!userId) throw new Error("User ID missing");

    if (!data?.title) {
      throw new Error("Category title is required");
    }

    // Optional: prevent duplicate title (per user)
    const existing = await this.categoryRepository.findByTitle(userId, data.title);

    if (existing) {
      throw new Error("Category with this title already exists");
    }

    return await this.categoryRepository.createCategory(userId, data);
  }

  async updateCategory(userId, categoryId, updateData) {
    if (!userId || !categoryId) return null;

    const category = await this.categoryRepository.getCategoryById(userId, categoryId);

    if (!category) return null;

    // Optional: prevent duplicate title on update
    if (updateData?.title && updateData.title !== category.title) {
      const existing = await this.categoryRepository.findByTitle(userId, updateData.title);
      if (existing) throw new Error("Another category with this title already exists");
    }

    return await this.categoryRepository.updateCategory(userId, categoryId, updateData);
  }

  async deleteCategory(userId, categoryId) {
    if (!userId || !categoryId) return null;

    const category = await this.categoryRepository.getCategoryById(userId, categoryId);

    if (!category) return null;

    // Optional: Cascade delete list items
    // await this.listItemRepository.deleteByCategory(categoryId);

    return await this.categoryRepository.deleteCategory(userId, categoryId);
  }

  async reorderCategory(userId, categoryId, newPosition) {
    if (!userId || !categoryId || typeof newPosition !== "number") {
      throw new Error("Invalid data for reordering");
    }

    const category = await this.categoryRepository.getCategoryById(userId, categoryId);

    if (!category) return null;

    // Update order
    return await this.categoryRepository.reorderCategory(userId, categoryId, newPosition);
  }

  // ===========================================
  //                 LIST ITEMS
  // ===========================================

  async createListItem(categoryId, data) {
    if (!categoryId) throw new Error("Category ID missing");
    if (!data?.title) throw new Error("Item title is required");

    return await this.listItemRepository.create(categoryId, data);
  }

  async getListItems(categoryId) {
    if (!categoryId) throw new Error("Category ID missing");

    const items = await this.listItemRepository.findAll(categoryId);
    return items || [];
  }

  async getListItem(categoryId, itemId) {
    if (!categoryId || !itemId) return null;

    return await this.listItemRepository.findOne(categoryId, itemId);
  }

  async updateListItem(categoryId, itemId, data) {
    if (!categoryId || !itemId) return null;

    const existing = await this.listItemRepository.findOne(categoryId, itemId);
    if (!existing) return null;

    return await this.listItemRepository.update(categoryId, itemId, data);
  }

  async deleteListItem(categoryId, itemId) {
    if (!categoryId || !itemId) return null;

    const existing = await this.listItemRepository.findOne(categoryId, itemId);
    if (!existing) return null;

    return await this.listItemRepository.delete(categoryId, itemId);
  }
}

module.exports = CategoryService;
