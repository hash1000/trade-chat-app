const OpenAI = require("openai");

class AiService {
  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.assistantId = process.env.OPENAI_ASSISTANT_ID;
  }

  /**
   * Main method to handle AI messages
   * @param {Object} payload - The request payload containing user message
   * @returns {Object} - JSON response formatted for QRM Assistant
   */
  async AiMessages(payload) {
    const userQuestion = payload?.message?.trim();
    if (!userQuestion) return this.createErrorResponse("No question provided");

    if (!this.assistantId?.startsWith("asst_")) {
      return this.createErrorResponse(`Invalid Assistant ID: ${this.assistantId}`);
    }

    try {
      console.log("🚀 Starting QRM Assistant...");

      // Step 1: Create thread
      const thread = await this.client.beta.threads.create();

      // Step 2: Add user message
      await this.client.beta.threads.messages.create(thread.id, {
        role: "user",
        content: userQuestion,
      });

      // Step 3: Run assistant
      const run = await this.client.beta.threads.runs.createAndPoll(thread.id, {
        assistant_id: this.assistantId,
      });

      console.log("✅ QRM Assistant run completed.");

      // Step 4: Fetch messages
      const messages = await this.client.beta.threads.messages.list(thread.id);
      const lastMessage = messages.data?.[0];

      // Step 5: Extract JSON
      const responseJson = this.extractJson(lastMessage);

      // ✅ Step 6: Final standardized structure
      return {
        success: true,
        message: "AI successfully processed your question",
        data: responseJson || this.defaultResponse(),
      };

    } catch (error) {
      console.error("❌ AI Service Error:", error);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * Extract valid JSON from message content
   */
  extractJson(message) {
    if (!message || !message.content) return null;

    for (const block of message.content) {
      if (block.type === "text" || block.type === "output_text") {
        try {
          // handle if assistant sends text.value instead of text
          const textValue = block.text?.value || block.text;
          const parsed = JSON.parse(textValue);
          if (
            parsed.status &&
            parsed.category &&
            parsed.assistant_greeting &&
            parsed.timestamp
          ) {
            return parsed;
          }
        } catch {
          // ignore invalid JSON
        }
      }
    }

    return null;
  }

  /**
   * Default fallback JSON
   */
  defaultResponse() {
    return {
      status: "success",
      category: "GENERAL_GUIDANCE",
      assistant_greeting:
        "Hello! QRM is a global chat, sales, and payment application developed by Nasko China. It's designed to help users manage messaging, sales transactions, and payments all in one secure platform. Let me know how I can assist you with QRM!",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Standardized error response
   */
  createErrorResponse(message) {
    return {
      success: false,
      message: message || "Service temporarily unavailable.",
      data: {
        status: "error",
        category: "SYSTEM_ERROR",
        assistant_greeting: message || "Sorry, service temporarily unavailable.",
        timestamp: new Date().toISOString(),
      },
    };
  }

   async ChatGPT(payload) {
    const { message, history = [] } = payload;
    if (!message) {
      return this.createErrorResponse("No message provided");
    }

    try {
      console.log("💬 ChatGPT-5 message received:", message);

      const chatMessages = [
        { role: "system", content: "You are a helpful AI assistant for QRM app." },
        ...history,
        { role: "user", content: message },
      ];

      // Use GPT-4o (ChatGPT-5 equivalent model)
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini", // fast & latest
        messages: chatMessages,
      });

      const reply = completion.choices[0].message.content;

      return {
        success: true,
        message: "ChatGPT responded successfully",
        data: {
          reply,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("❌ ChatGPT Service Error:", error);
      return this.createErrorResponse(error.message);
    }
  }
}

module.exports = AiService;
