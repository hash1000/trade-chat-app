const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/CategoryController');
const authenticate = require('../middlewares/authenticate');

const categoryController = new CategoryController();


router.get('/', authenticate, categoryController.getCategories);
router.get('/:id', authenticate, categoryController.getCategoryById);
router.post('/', authenticate, categoryController.createCategory);
router.put('/:id', authenticate, categoryController.updateCategory);
router.delete('/:id', authenticate, categoryController.deleteCategory);
router.put('/:id/reorder', authenticate, categoryController.reorderCategory);


// LIST ITEMS
router.post('/:id/items', authenticate, categoryController.createListItem);
router.get('/:id/items', authenticate, categoryController.getListItems);
router.get('/:id/items/:itemId', authenticate, categoryController.getListItem);
router.put('/:id/items/:itemId', authenticate, categoryController.updateListItem);
router.delete('/:id/items/:itemId', authenticate, categoryController.deleteListItem);

// List
router.post('/:categoryId/shortlists/:shortListId/lists', authenticate, categoryController.createList);
router.get('/:categoryId/shortlists/:shortListId/lists', authenticate, categoryController.getLists);
router.get('/:categoryId/shortlists/:shortListId/lists/:listId', authenticate, categoryController.getList);
router.put('/:categoryId/shortlists/:shortListId/lists/:listId', authenticate, categoryController.updateList);
router.delete('/:categoryId/shortlists/:shortListId/lists/:listId', authenticate, categoryController.deleteList);


module.exports = router;
