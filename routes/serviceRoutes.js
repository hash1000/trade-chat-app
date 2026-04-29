const express = require("express");
const router = express.Router();
const ServiceController = require("../controllers/ServiceController");
const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");
const authorize = require("../middlewares/authorization");

const serviceController = new ServiceController();

router.get("/", authMiddleware, serviceController.list.bind(serviceController));
router.get("/:id", authMiddleware, checkIntegerParam("id"), serviceController.getById.bind(serviceController));
router.post("/", authMiddleware,authorize(["admin"]), serviceController.create.bind(serviceController));
router.put("/:id", authMiddleware,authorize(["admin"]), checkIntegerParam("id"), serviceController.update.bind(serviceController));
router.delete("/:id", authMiddleware,authorize(["admin"]), checkIntegerParam("id"), serviceController.delete.bind(serviceController));
router.post("/:id/teams", authMiddleware, checkIntegerParam("id"), serviceController.addTeam.bind(serviceController));
router.delete("/:id/teams/:teamId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("teamId"), serviceController.removeTeam.bind(serviceController));
router.post("/:id/categories", authMiddleware, checkIntegerParam("id"), serviceController.addCategory.bind(serviceController));
router.delete("/:id/categories/:categoryId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("categoryId"), serviceController.removeCategory.bind(serviceController));

module.exports = router;
