const CategoryService = require('../services/CategoryService');
const categoryService = new CategoryService();

class CategoryController {
  async getCategories(req, res) {
    try {
      const { id: userId } = req.user;
      const categories = await categoryService.getCategoriesByUserId(userId);
      res.json(categories);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  async getCategoryById(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;

      const category = await categoryService.getCategoryById(userId, id);
      if (!category) return res.status(404).json({ error: 'Category not found' });

      res.json(category);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  async createCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const { title, description, adminNote, customerNote, paymentTypeId } = req.body;

      const newCategory = await categoryService.createCategory(userId, {
        title,
        description,
        adminNote,
        customerNote,
        paymentTypeId,
      });

      res.status(201).json(newCategory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  async updateCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const updatedCategory = await categoryService.updateCategory(userId, id, updateData);
      if (!updatedCategory) return res.status(404).json({ error: 'Category not found' });

      res.json(updatedCategory);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  async deleteCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;

      const result = await categoryService.deleteCategory(userId, id);
      if (!result) return res.status(404).json({ error: 'Category not found' });

      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }

  async reorderCategory(req, res) {
    try {
      const { id: userId } = req.user;
      const { id } = req.params;
      const { newPosition } = req.body;

      if (!newPosition || newPosition < 1) {
        return res.status(400).json({ error: 'Valid newPosition is required' });
      }

      const reordered = await categoryService.reorderCategory(userId, id, newPosition);
      if (!reordered) return res.status(404).json({ error: 'Category not found' });

      res.json(reordered);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server Error' });
    }
  }
}

module.exports = CategoryController;
