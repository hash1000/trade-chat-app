const AiService = require("../services/AiService");
const aiService = new AiService();

class AiController {
  async AiMessages(req, res) {
    try {
      const messages = await aiService.AiMessages(req.body.payload);
      res.status(200).json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
}

module.exports = AiController;
