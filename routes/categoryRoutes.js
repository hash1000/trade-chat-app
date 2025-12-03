const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const authenticate = require('../middlewares/authenticate');
const { addCategoryValidator } = require('../middlewares/categoryValidation');

const categoryController = new CategoryController();


router.post('/', authenticate, addCategoryValidator, categoryController.createCategory);
router.put('/:id', authenticate, categoryController.updateCategory);
router.delete('/:id', authenticate, categoryController.deleteCategory);
router.get('/', authenticate, categoryController.getCategories);
router.get('/:id', authenticate, categoryController.getCategoryById);

module.exports = router;
