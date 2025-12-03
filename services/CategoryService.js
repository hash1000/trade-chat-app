const CategoryRepository = require('../repositories/CategoryRepository');
const ListItemRepository = require('../repositories/ShortListRepository');

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

    const categories = await this.categoryRepository.findAll(userId);
    return categories || [];
  }

  async getCategoryById(userId, categoryId) {
    return await this.categoryRepository.getCategoryById(userId, categoryId);
  }

  async createCategory(userId, title) {
    console.log("userId, title",userId, title);

    // Optional: prevent duplicate title (per user)
    const existing = await this.categoryRepository.findByTitle(userId, title);

    if (existing) {
      throw new Error("Category with this title already exists");
    }

    return await this.categoryRepository.createCategory(userId, title);
  }

  async updateCategory(userId, categoryId, title) {


    console.log("title",title);
    // Check if category exists for this user
    const category = await this.categoryRepository.findById(categoryId, userId);
    if (!category) {
      throw new Error("Category not found");
    }

    // Check if another category with same title exists
    const duplicate = await this.categoryRepository.findByTitle(userId, title);
    if (duplicate && duplicate.id !== categoryId) {
      throw new Error("Another category with this title already exists");
    }

    await this.categoryRepository.updateCategory(categoryId, userId, title);

    return { id: categoryId, title };
  }

   // Delete category by userId and categoryId
  async deleteCategory(userId, categoryId) {
    const category = await this.categoryRepository.findById(categoryId, userId);
    if (!category) {
      throw new Error("Category not found");
    }

    const success = await this.categoryRepository.deleteCategory(categoryId, userId);
    if (!success) {
      throw new Error("Failed to delete category");
    }

    return { message: "Category deleted successfully" };
  }

}

module.exports = CategoryService;
