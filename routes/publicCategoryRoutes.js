const express = require("express");
const router = express.Router();
const PublicCategoryController = require("../controllers/PublicCategoryController");
const { addCategoryValidator } = require("../middlewares/categoryValidation");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorization");

const publicCategoryController = new PublicCategoryController();

// Reading is public. Admins and sellers (any signed-in user) can create a
// category; renaming / deleting a shared category is admin-only because
// categories don't record who created them.
router.post(
  "/",
  authenticate,
  addCategoryValidator,
  publicCategoryController.createCategory
);
router.put("/:id", authenticate, authorize(["admin"]), publicCategoryController.updateCategory);
router.delete("/:id", authenticate, authorize(["admin"]), publicCategoryController.deleteCategory);
router.get("/", publicCategoryController.getCategories);
router.get("/:id", publicCategoryController.getCategoryById);

module.exports = router;
