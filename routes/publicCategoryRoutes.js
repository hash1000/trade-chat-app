const express = require("express");
const router = express.Router();
const PublicCategoryController = require("../controllers/PublicCategoryController");
const { addCategoryValidator } = require("../middlewares/categoryValidation");

const publicCategoryController = new PublicCategoryController();

router.post(
  "/",
  addCategoryValidator,
  publicCategoryController.createCategory
);
router.put("/:id", publicCategoryController.updateCategory);
router.delete("/:id", publicCategoryController.deleteCategory);
router.get("/", publicCategoryController.getCategories);
router.get("/:id", publicCategoryController.getCategoryById);

module.exports = router;
