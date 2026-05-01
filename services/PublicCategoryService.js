const PublicCategoryRepository = require("../repositories/PublicCategoryRepository");

class PublicCategoryService {
  constructor() {
    this.publicCategoryRepository = new PublicCategoryRepository();
  }

  // ===========================================
  //                 CATEGORY
  // ===========================================

  async getCategories(filters = {}) {

    const categories = await this.publicCategoryRepository.findAll(filters);
    return categories || [];
  }

  async getCategoryById(categoryId) {
    return await this.publicCategoryRepository.getCategoryById(categoryId);
  }

  async createCategory(title, type) {
    const normalizedTitle = typeof title === "string" ? title.trim() : title;
    const normalizedType = typeof type === "string" && type.trim() ? type.trim() : undefined;

    // Optional: prevent duplicate title (per user)
    const existing = await this.publicCategoryRepository.findByTitle(
      normalizedTitle,
      normalizedType
    );

    if (existing) {
      throw new Error("Category with this title already exists");
    }

    return await this.publicCategoryRepository.createCategory(
      normalizedTitle,
      normalizedType
    );
  }

  async updateCategory(categoryId, data) {
    // Check if category exists for this user
    const category = await this.publicCategoryRepository.findById(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const updateData = {};
    if (data.title !== undefined) {
      updateData.title = typeof data.title === "string" ? data.title.trim() : data.title;
    }
    if (data.type !== undefined) {
      updateData.type = typeof data.type === "string" && data.type.trim() ? data.type.trim() : null;
    }

    const nextTitle = updateData.title !== undefined ? updateData.title : category.title;
    const nextType = updateData.type !== undefined ? updateData.type : category.type;

    // Check if another category with same title exists
    const duplicate = await this.publicCategoryRepository.findByTitle(
      nextTitle,
      nextType
    );
    if (duplicate && Number(duplicate.id) !== Number(categoryId)) {
      throw new Error("Another category with this title already exists");
    }

    await this.publicCategoryRepository.updateCategory(categoryId, updateData);

    return { id: categoryId, title: nextTitle, type: nextType };
  }

  // Delete category by userId and categoryId
  async deleteCategory(categoryId) {
    const category = await this.publicCategoryRepository.findById(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const success = await this.publicCategoryRepository.deleteCategory(
      categoryId
    );
    if (!success) {
      throw new Error("Failed to delete category");
    }

    return { message: "Category deleted successfully" };
  }
}

module.exports = PublicCategoryService;
