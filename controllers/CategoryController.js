const CategoryService = require("../services/CategoryService");
const categoryService = new CategoryService();

class CategoryController {
  async getCategories(req, res) {
    try {
      const { id: userId } = req.user;
      const categories = await categoryService.getCategoriesByUserId(userId);

      return res.status(200).json({
        success: true,
        data: categories,
      });

    } catch (error) {
      console.error("getCategories Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async getCategoryById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;

      const category = await categoryService.getCategoryById(userId, id);

      if (!category) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      return res.status(200).json({
        success: true,
        data: category,
      });

    } catch (error) {
      console.error("getCategoryById Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  
  async createCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const { title } = req.body;

      console.log("title", title, userId);

      // Attempt to create the category
      const category = await categoryService.createCategory(userId, title);

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
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

// category.controller.js

  async updateCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const categoryId = req.params.id;
      const { title } = req.body;

      const updated = await categoryService.updateCategory(userId, categoryId, title);

      return res.status(200).json({
        success: true,
        message: "Category updated successfully",
        data: updated,
      });
    } catch (error) {
      console.error("updateCategory Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  // Delete category by userId and categoryId
  async deleteCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const categoryId = req.params.id;

      const result = await categoryService.deleteCategory(userId, categoryId);

      return res.status(200).json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error("deleteCategory Error:", error);

      if (error.message === "Category not found") {
        return res.status(404).json({
          success: false,
          error: "Category not found"
        });
      }

      return res.status(500).json({
        success: false,
        error: "Server Error"
      });
    }
  }

}

module.exports = CategoryController;
