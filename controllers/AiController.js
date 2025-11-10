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
      const response = await aiService.ChatGPT(req.body);
      res.status(200).json(response);
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
