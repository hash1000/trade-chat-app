const express = require("express");
const router = express.Router();
const TeamController = require("../controllers/TeamController");
const authMiddleware = require("../middlewares/authenticate");
const checkIntegerParam = require("../middlewares/paramIntegerValidation");

const teamController = new TeamController();

router.get("/my", authMiddleware, teamController.myTeams.bind(teamController));
router.get("/", authMiddleware, teamController.list.bind(teamController));
router.get("/:id", authMiddleware, checkIntegerParam("id"), teamController.getById.bind(teamController));
router.post("/", authMiddleware, teamController.create.bind(teamController));
router.put("/:id", authMiddleware, checkIntegerParam("id"), teamController.update.bind(teamController));
router.delete("/:id", authMiddleware, checkIntegerParam("id"), teamController.delete.bind(teamController));
router.post("/:id/members", authMiddleware, checkIntegerParam("id"), teamController.addMember.bind(teamController));
router.delete("/:id/members/:userId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("userId"), teamController.removeMember.bind(teamController));
router.post("/:id/services", authMiddleware, checkIntegerParam("id"), teamController.addService.bind(teamController));
router.delete("/:id/services/:serviceId", authMiddleware, checkIntegerParam("id"), checkIntegerParam("serviceId"), teamController.removeService.bind(teamController));

module.exports = router;
