const { User } = require("../models");
const OpenAI = require("openai");

const MODEL = "gpt-5"; // or gpt-5-chat-latest, gpt-5-mini
const MAX_HISTORY = 12;
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

  // async chatWithAI(userId, message, image) {
  //   if (!message) {
  //     return { success: false, message: "No message provided" };
  //   }

  //   try {
  //     // ✨ 1️⃣ If it's an image request → Generate image
  //     if (image) {
  //       const generatedImage = await this.client.images.generate({
  //         model: "gpt-image-1",
  //         prompt: message,
  //         size: "1024x1024",
  //       });

  //       console.log("✅ Image generated.", generatedImage);

  //       return {
  //         success: true,
  //         message: "Image generated",
  //         type: "image",
  //         url: generatedImage.data[0].url,
  //       };
  //     }

  //     // 🧠 2️⃣ Continue assistant conversation
  //     const user = await User.findOne({ where: { id: userId } });
  //     let threadId = user.ai_thread_id;

  //     if (!threadId) {
  //       const thread = await this.client.beta.threads.create();
  //       threadId = thread.id;

  //       await User.update(
  //         { ai_thread_id: threadId },
  //         { where: { id: userId } }
  //       );
  //     }

  //     // Add message
  //     await this.client.beta.threads.messages.create(threadId, {
  //       role: "user",
  //       content: message,
  //     });

  //     // Run assistant
  //     await this.client.beta.threads.runs.createAndPoll(threadId, {
  //       assistant_id: this.gptAssistantId,
  //     });

  //     // Fetch response
  //     const messages = await this.client.beta.threads.messages.list(threadId);
  //     const last = messages.data.find((msg) => msg.role === "assistant");
  //     const reply = last?.content[0]?.text?.value || "";

  //     return {
  //       success: true,
  //       type: "text",
  //       message: "AI responded successfully",
  //       data: { reply, threadId },
  //     };
  //   } catch (error) {
  //     console.error("❌ ChatGPT API Error:", error);

  //     // ⚠️ Billing limit check
  //     if (error.code === "billing_hard_limit_reached") {
  //       return this.createErrorResponse(
  //         "Your OpenAI billing limit is reached. Please upgrade your plan."
  //       );
  //     }

  //     // Other errors
  //     return this.createErrorResponse(error.message);
  //   }
  // }

  async chatWithAI(userId, message, image = false) {
    if (!message) {
      return { success: false, message: "No message provided" };
    }

    try {
      if (image) {
        // Generate image using OpenAI
        const imageResponse = await this.client.images.generate({
          model: "gpt-image-1",
          prompt: message,
          size: "1024x1024",
        });

        if (!imageResponse?.data?.[0]?.b64_json) {
          throw new Error("Image generation failed");
        }

        // Convert base64 JSON to data URL for direct viewing
        const imageDataUrl = `data:image/png;base64,${imageResponse.data[0].b64_json}`;

        return {
          success: true,
          type: "image",
          url: imageDataUrl,
          message: "Image generated successfully",
        };
      }

      // Generate text response using GPT-5
      const response = await this.client.responses.create({
        model: "gpt-5.1",
        input: [
          {
            role: "system",
            content: `
              You are GPT-5.1.

              When the user asks about the model, answer naturally and conversationally.
              Do NOT always say "I am GPT-5.1." in a fixed way.

              Instead:
              - Answer in a natural, human-like tone.
              - You may say variations like: 
                "I'm based on GPT-5.1.", 
                "You're chatting with the GPT-5.1 model.", 
                "I'm running on GPT-5.1 capabilities."
              - Only mention the model if the user directly asks.

              If the user is NOT asking about the model, do NOT mention it at all.
              `,
          },
          {
            role: "user",
            content: message,
          },
        ],
      });

      return {
        success: true,
        type: "text",
        message: "AI responded successfully",
        data: response.output_text,
      };
    } catch (error) {
      console.error("❌ OpenAI API Error:", error);

      // Handle billing limit error
      if (error.code === "billing_hard_limit_reached") {
        return this.createErrorResponse(
          "Your OpenAI billing limit is reached. Please upgrade your plan."
        );
      }

      // Generic error
      return this.createErrorResponse(
        error.message || "Service temporarily unavailable."
      );
    }
  }
}

module.exports = AiService;
