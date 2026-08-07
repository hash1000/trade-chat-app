const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authenticate");
const ChatController = require("../controllers/ChatController");
const chatController = new ChatController();

// List the caller's chats (add ?archived=true for the archived list).
router.get("/", authMiddleware, chatController.list.bind(chatController));

// Fetch a single chat/group by id.
router.get("/:id", authMiddleware, chatController.getById.bind(chatController));

// Start (or fetch existing) 1:1 chat with another user.
router.post("/direct", authMiddleware, chatController.createDirect.bind(chatController));

// Create a multi-member group.
router.post("/group", authMiddleware, chatController.createGroup.bind(chatController));

// Create a customer <-> team chat for a single service request.
router.post("/service", authMiddleware, chatController.createServiceChat.bind(chatController));

// Create (or reuse) the combined chat for every isChat service in an order.
router.post("/order", authMiddleware, chatController.createOrGetOrderChat.bind(chatController));

router.post("/:id/members", authMiddleware, chatController.addMembers.bind(chatController));
router.delete("/:id/members/:userId", authMiddleware, chatController.removeMember.bind(chatController));

// Caller removes themselves. If they were the group admin, the oldest
// remaining member is auto-promoted.
router.post("/:id/leave", authMiddleware, chatController.leave.bind(chatController));

router.put("/:id/favourite", authMiddleware, chatController.setFavourite.bind(chatController));
router.put("/:id/archive", authMiddleware, chatController.setArchived.bind(chatController));
router.put("/:id/block", authMiddleware, chatController.setBlocked.bind(chatController));
router.put("/:id/read", authMiddleware, chatController.markRead.bind(chatController));
router.put("/:id/settings", authMiddleware, chatController.updateSettings.bind(chatController));

router.delete("/:id", authMiddleware, chatController.remove.bind(chatController));

module.exports = router;
