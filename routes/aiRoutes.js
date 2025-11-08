const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authenticate");
const AiController = require("../controllers/AiController");
const aiController = new AiController();

router.post("/assistant", authMiddleware, aiController.AiMessages.bind(aiController));

module.exports = router;
