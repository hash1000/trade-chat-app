// routes/list.routes.js
const express = require("express");
const router = express.Router();
const ListController = require("../controllers/ListController");
const authenticate = require('../middlewares/authenticate');
const { addListValidator } = require("../middlewares/listValidation");

const listController = new ListController();

// Routes
router.post("/:id", authenticate, addListValidator, listController.createListItem);
router.post("/reorder/:id", authenticate, listController.reorderListItems);  // New route for reordering
router.get("/:id", authenticate, listController.getListItems);
router.get("/single/:listId", authenticate, listController.getSingleListItems);
router.put("/:listId/:id", authenticate, listController.updateListItem);
router.delete("/:id", authenticate, listController.deleteListItem);

module.exports = router;
