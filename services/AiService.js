const { User } = require("../models");
const OpenAI = require("openai");

class AiService {
  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.assistantId = process.env.OPENAI_ASSISTANT_ID;
    this.gptAssistantId = process.env.OPENAI_GPT_ASSISTANT_ID;
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
      return this.createErrorResponse(
        `Invalid Assistant ID: ${this.assistantId}`
      );
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
        assistant_greeting:
          message || "Sorry, service temporarily unavailable.",
        timestamp: new Date().toISOString(),
      },
    };
  }

  async chatWithAI(userId, message) {
    if (!message) {
      return { success: false, message: "No message provided" };
    }

    // 1️⃣ Get user
    const user = await User.findOne({ where: { id: userId } });

    let threadId = user.ai_thread_id;

    // 2️⃣ Create thread if not exists
    if (!threadId) {
      const thread = await this.client.beta.threads.create();
      threadId = thread.id;

      console.log("Created new AI thread:", threadId);

      await User.update(
        { ai_thread_id: threadId },
        { where: { id: userId } }
      );
    }

    // 3️⃣ Add user message to thread
    await this.client.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // 4️⃣ Run assistant and wait until done
    await this.client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: this.gptAssistantId,
    });

    // 6️⃣ Fetch messages
    const messages = await this.client.beta.threads.messages.list(threadId);

    const last = messages.data.find((msg) => msg.role === "assistant");

    const reply = last?.content[0]?.text?.value || "";

    return {
      success: true,
      message: "AI responded successfully",
      data: {
        reply,
        threadId,
      },
    };
  }

}

module.exports = AiService;
