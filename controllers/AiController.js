const AiService = require("../services/AiService");
const aiService = new AiService();

class AiController {
  async AiMessages(req, res) {
    try {
      const messages = await aiService.AiMessages(req.body);
      res.status(200).json(messages);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }

  async ChatGPT(req, res) {
    try {
      const userId = req.user.id;
      const { message, image } = req.body;

      const result = await aiService.chatWithAI(userId, message, image);

      res.status(200).json(result);
    } catch (error) {
      console.error("ChatGPT API Error:", error);

      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }

}

module.exports = AiController;
