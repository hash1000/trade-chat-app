const CategoryService = require("../services/CategoryService");
const categoryService = new CategoryService();

class CategoryController {
  async getCategories(req, res) {
    try {
      const userId = req.user?.id;
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
      const userId = req.user?.id;
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
      const userId = req.user?.id;
      const { title, description, adminNote, customerNote, paymentTypeId } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, error: "Title is required" });
      }

      const category = await categoryService.createCategory(userId, {
        title,
        description,
        adminNote,
        customerNote,
        paymentTypeId,
      });

      return res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      });

    } catch (error) {
      console.error("createCategory Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async updateCategory(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const updateData = req.body;

      const updated = await categoryService.updateCategory(userId, id, updateData);

      if (!updated) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Category updated",
        data: updated,
      });

    } catch (error) {
      console.error("updateCategory Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async deleteCategory(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      const deleted = await categoryService.deleteCategory(userId, id);

      if (!deleted) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Category deleted successfully",
      });

    } catch (error) {
      console.error("deleteCategory Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async reorderCategory(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { newPosition } = req.body;

      if (!newPosition || newPosition < 1) {
        return res.status(400).json({ success: false, error: "Valid newPosition is required" });
      }

      const reordered = await categoryService.reorderCategory(userId, id, newPosition);

      if (!reordered) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Category reordered",
        data: reordered,
      });

    } catch (error) {
      console.error("reorderCategory Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }


  // -----------------
  // LIST ITEM METHODS
  // -----------------

  async createListItem(req, res) {
    try {
      const userId = req.user?.id;
      const { id: categoryId } = req.params;
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ success: false, error: "Title is required" });
      }

      const category = await categoryService.getCategoryById(userId, categoryId);
      if (!category) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      const item = await categoryService.createListItem(categoryId, { title, description });

      return res.status(201).json({
        success: true,
        message: "Item added successfully",
        data: item,
      });

    } catch (error) {
      console.error("createListItem Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async getListItems(req, res) {
    try {
      const userId = req.user?.id;
      const { id: categoryId } = req.params;

      const category = await categoryService.getCategoryById(userId, categoryId);
      if (!category) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      const items = await categoryService.getListItems(categoryId);

      return res.status(200).json({
        success: true,
        data: items,
      });

    } catch (error) {
      console.error("getListItems Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async getListItem(req, res) {
    try {
      const userId = req.user?.id;
      const { id: categoryId, itemId } = req.params;

      const category = await categoryService.getCategoryById(userId, categoryId);
      if (!category) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      const item = await categoryService.getListItem(categoryId, itemId);

      if (!item) {
        return res.status(404).json({ success: false, error: "List item not found" });
      }

      return res.status(200).json({
        success: true,
        data: item,
      });

    } catch (error) {
      console.error("getListItem Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async updateListItem(req, res) {
    try {
      const userId = req.user?.id;
      const { id: categoryId, itemId } = req.params;

      const category = await categoryService.getCategoryById(userId, categoryId);
      if (!category) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      const updated = await categoryService.updateListItem(categoryId, itemId, req.body);

      if (!updated) {
        return res.status(404).json({ success: false, error: "List item not found" });
      }

      return res.status(200).json({
        success: true,
        message: "List item updated",
        data: updated,
      });

    } catch (error) {
      console.error("updateListItem Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }

  async deleteListItem(req, res) {
    try {
      const userId = req.user?.id;
      const { id: categoryId, itemId } = req.params;

      const category = await categoryService.getCategoryById(userId, categoryId);
      if (!category) {
        return res.status(404).json({ success: false, error: "Category not found" });
      }

      const deleted = await categoryService.deleteListItem(categoryId, itemId);

      if (!deleted) {
        return res.status(404).json({ success: false, error: "List item not found" });
      }

      return res.status(200).json({
        success: true,
        message: "List item deleted",
      });

    } catch (error) {
      console.error("deleteListItem Error:", error);
      return res.status(500).json({ success: false, error: "Server Error" });
    }
  }
}

module.exports = CategoryController;
