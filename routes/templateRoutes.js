const express = require("express");
const router = express.Router();
const TemplateController = require("../controllers/TemplateController");
const authenticate = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const {
  createTemplateValidator,
  updateTemplateValidator,
  reorderTemplatesValidator,
} = require("../middlewares/templateValidation");

const templateController = new TemplateController();

// The authenticated user's own message templates (formerly the Firestore
// "templates" collection). /reorder is declared before /:id on purpose.
router.get("/", authenticate, templateController.getTemplates);
router.post("/", authenticate, createTemplateValidator, templateController.createTemplate);
router.put("/reorder", authenticate, reorderTemplatesValidator, templateController.reorderTemplates);
router.get("/:id", authenticate, checkIntegerParam("id"), templateController.getTemplate);
router.put("/:id", authenticate, checkIntegerParam("id"), updateTemplateValidator, templateController.updateTemplate);
router.delete("/:id", authenticate, checkIntegerParam("id"), templateController.deleteTemplate);
router.post("/:id/duplicate", authenticate, checkIntegerParam("id"), templateController.duplicateTemplate);

module.exports = router;
