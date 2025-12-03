// routes/shortList.routes.js
const express = require("express");
const router = express.Router();
const ShortListController = require("../controllers/ShortListController");
const authenticate = require('../middlewares/authenticate');  // Assuming you have an authentication middleware
const { addShortItemValidator } = require("../middlewares/shortListValidation");

const shortListController = new ShortListController();

// Create new item - Validation applied for title and optional fields
router.post("/", authenticate, addShortItemValidator, shortListController.createListItem);
router.get("/", authenticate, shortListController.getListItems);
router.get("/:id", authenticate, shortListController.getListItem);
router.put("/:id", authenticate, addShortItemValidator, shortListController.updateListItem);
router.delete("/:id", authenticate, shortListController.deleteListItem);

module.exports = router;
