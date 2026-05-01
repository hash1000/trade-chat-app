const PublicCategoryService = require("../services/PublicCategoryService");
const publicCategoryService = new PublicCategoryService();

class PublicCategoryController {
  async getCategories(req, res) {
    try {
      const { type } = req.query;
      const filters = {};
      if (typeof type === "string" && type.trim()) {
        filters.type = type.trim();
      }

      const categories = await publicCategoryService.getCategories(filters);

      return res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error("getCategories Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  async getCategoryById(req, res) {
    try {
      const { id } = req.params;

      const category = await publicCategoryService.getCategoryById(id);

      if (!category) {
        return res
          .status(404)
          .json({ success: false, error: "Category not found" });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      console.error("getCategoryById Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  async createCategory(req, res) {
    try {
      const { title, type } = req.body;

      // Attempt to create the category
      const category = await publicCategoryService.createCategory(title, type);

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      console.error("createCategory Error:", error);

      // Check for unique constraint error or custom error thrown for duplicate title
      if (error.message === "Category with this title already exists") {
        return res.status(400).json({
          success: false,
          error: "Category title already exists for this user",
        });
      }

      // For any other errors, return a generic server error
      return res.status(500).json({ success: false, error: error.errors || "Server Error" });
    }
  }

  // category.controller.js

  async updateCategory(req, res) {
    try {
      const categoryId = req.params.id;
      const { title, type } = req.body;

      const updated = await publicCategoryService.updateCategory(
        categoryId,
        { title, type }
      );

      return res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: updated,
      });
    } catch (error) {
      console.error("updateCategory", error);
      return res.status(500).json({ success: false, error: error.message || "Internal Server Error" });
    }
  }

  async pinCategory(req, res) {
    try {
      const { categoryId } = req.params;

      const result = await publicCategoryService.pinCategory(categoryId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error("pinCategory Error:", error);
      return res.status(500).json({ success: false, error: error.message || "Server Error" });
    }
  }

  // Delete category by userId and categoryId
  async deleteCategory(req, res) {
    try {
      const categoryId = req.params.id;

      const result = await publicCategoryService.deleteCategory(categoryId);

      return res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      console.error("deleteCategory Error:", error);

      return res.status(500).json({
        success: false,
        error: error.message || "Server Error",
      });
    }
  }
}

module.exports = PublicCategoryController;
