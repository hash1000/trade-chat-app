const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authenticate");
const ChatController = require("../controllers/ChatController");
const MessageController = require("../controllers/MessageController");
const chatController = new ChatController();
const messageController = new MessageController();

// List the caller's chats (add ?archived=true for the archived list).
router.get("/", authMiddleware, chatController.list.bind(chatController));

// Is this user my friend / do we already have a 1:1 chat (and its id).
// Must stay above "/:id" — otherwise "relationship" would be swallowed as :id.
router.get("/relationship/:userId", authMiddleware, chatController.getRelationship.bind(chatController));

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
// Bulk remove — { memberIds[] } in the body, mirrors the POST above.
router.delete("/:id/members", authMiddleware, chatController.removeMembers.bind(chatController));

// Caller removes themselves. If they were the group admin, the oldest
// remaining member is auto-promoted.
router.post("/:id/leave", authMiddleware, chatController.leave.bind(chatController));

router.put("/:id/favourite", authMiddleware, chatController.setFavourite.bind(chatController));
router.put("/:id/archive", authMiddleware, chatController.setArchived.bind(chatController));
router.put("/:id/block", authMiddleware, chatController.setBlocked.bind(chatController));
// Personal — mutes/unmutes push notifications for this chat, caller only.
router.put("/:id/mute", authMiddleware, chatController.setMuted.bind(chatController));
router.put("/:id/read", authMiddleware, chatController.markRead.bind(chatController));
// Admin-only (this chat's admin or a platform admin) — see ChatService.updateSettings.
router.put("/:id/settings", authMiddleware, chatController.updateSettings.bind(chatController));

router.delete("/:id", authMiddleware, chatController.remove.bind(chatController));

// "Clear chat" — clears the caller's own message history but the chat
// stays in their list (unlike DELETE /:id above, which also hides it) —
// see ChatService.clearMessagesForUser. `{ forEveryone: true }` switches
// this to an admin-only "recall all" instead — see
// ChatService.recallAllMessagesForEveryone.
router.delete("/:id/messages", authMiddleware, chatController.clearMessages.bind(chatController));

// Real, permanent delete — every participant loses the chat at once,
// cannot be undone. 403 unless caller is this chat's own admin or holds
// the platform "admin" role — see ChatService.hardDeleteChat.
router.delete("/:id/hard-delete", authMiddleware, chatController.hardDeleteChat.bind(chatController));

// Messages are created over the socket ("send message" event, see
// socket/chatSocket.js) — REST only covers paginated history and
// per-recipient read/delete state.
router.get("/:chatId/messages", authMiddleware, messageController.history.bind(messageController));
router.put("/:chatId/messages/seen", authMiddleware, messageController.markSeen.bind(messageController));
router.put("/messages/:messageId/uploaded", authMiddleware, messageController.markUploaded.bind(messageController));
router.delete("/messages/:messageId", authMiddleware, messageController.deleteForMe.bind(messageController));

module.exports = router;
