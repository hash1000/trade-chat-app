const Category = require("../models/categories");
const sequelize = require("../config/database");
const CategoryRepository = require("../repositories/CategoryRepository");

class CategoryService {
  constructor() {
    this.categoryRepository = new CategoryRepository();
  }

  // ===========================================
  //                 CATEGORY
  // ===========================================

  async getCategoriesByUserId(userId, filters = {}) {
    if (!userId) throw new Error("User ID is required");

    const categories = await this.categoryRepository.findAll(userId, filters);
    return categories || [];
  }

  async getCategoryById(userId, categoryId) {
    return await this.categoryRepository.getCategoryById(userId, categoryId);
  }

  async createCategory(userId, title, type) {
    const normalizedTitle = typeof title === "string" ? title.trim() : title;
    const normalizedType = typeof type === "string" && type.trim() ? type.trim() : undefined;

    // Optional: prevent duplicate title (per user)
    const existing = await this.categoryRepository.findByTitle(
      userId,
      normalizedTitle,
      normalizedType
    );

    if (existing) {
      throw new Error("Category with this title already exists");
    }

    return await this.categoryRepository.createCategory(
      userId,
      normalizedTitle,
      normalizedType
    );
  }

  async pinCategory(userId, categoryId) {
    const transaction = await sequelize.transaction();

    try {
      // Check if category exists for this user
      const category = await Category.findOne({
        where: { id: categoryId, userId },
        transaction,
      });

      if (!category) {
        await transaction.rollback();
        return { success: false, message: "Category not found" };
      }

      // Check already pinned category
      const alreadyPinned = await this.categoryRepository.findPinned(userId);

      // If same category already pinned → stop
      if (alreadyPinned && alreadyPinned.id === categoryId) {
        await transaction.rollback();
        return {
          success: false,
          message: "This category is already pinned",
        };
      }

      // Unpin previously pinned category (ONLY ONE)
      await Category.update(
        { pin: 0 },
        { where: { userId, pin: 1 }, transaction }
      );

      // Pin selected category
      await Category.update(
        { pin: 1 },
        { where: { id: categoryId, userId }, transaction }
      );

      await transaction.commit();

      return { success: true, message: "Category pinned successfully" };
    } catch (error) {
      await transaction.rollback();
      console.error("pinCategory error:", error);
      return { success: false, message: "Failed to pin category" };
    }
  }

  async updateCategory(userId, categoryId, data) {
    // Check if category exists for this user
    const category = await this.categoryRepository.findById(categoryId, userId);
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
    const duplicate = await this.categoryRepository.findByTitle(
      userId,
      nextTitle,
      nextType
    );
    if (duplicate && Number(duplicate.id) !== Number(categoryId)) {
      throw new Error("Another category with this title already exists");
    }

    await this.categoryRepository.updateCategory(categoryId, userId, updateData);

    return { id: categoryId, title: nextTitle, type: nextType };
  }

  // Delete category by userId and categoryId
  async deleteCategory(userId, categoryId) {
    const category = await this.categoryRepository.findById(categoryId, userId);
    if (!category) {
      throw new Error("Category not found");
    }

    const success = await this.categoryRepository.deleteCategory(
      categoryId,
      userId
    );
    if (!success) {
      throw new Error("Failed to delete category");
    }

    return { message: "Category deleted successfully" };
  }
}

module.exports = CategoryService;
