# Chat & Sockets — API Reference

Base URL: `http://<host>:<PORT>` (droplet: `http://167.71.209.170:5001`)
All REST routes below are mounted under `/api/chat` or `/api/user` and require
`Authorization: Bearer <jwt>` unless noted.

Status key: ✅ works · ⚠️ works with caveats · ❌ broken/not implemented.

---

## 1. Auth

JWT is a plain `{ userId }` payload signed with `JWT_SECRET_KEY`, no extra
claims. Get one from your existing login/verify flow
(`POST /api/auth/verify`, etc. — not chat-specific, not covered here).

---

## 2. Socket.IO connection ✅

```js
const socket = io("http://167.71.209.170:5001", {
  path: "/socket.io",
  auth: { token: "<jwt>" }, // must be auth.token, NOT a query param
  transports: ["websocket"],
});
```

Server: [socket/chatSocket.js](../socket/chatSocket.js)

- Handshake is rejected (`connect_error`) if the token is missing or invalid.
- On connect, the socket auto-joins room `user-<userId>` — used for
  account-level pushes (see `chat request` below).
- The old `client.html` in the repo root passes the token via `query`, which
  this server does **not** read. Don't copy it.

### `join chat room` ✅

```js
socket.emit("join chat room", { chatId: 5 }, (ack) => {
  // { joined: 5 }  or  { error: "Not a participant of this chat" }
});
```

Server verifies you're `user1Id` or `user2Id` on that chat row before letting
you join `chat-<chatId>`. You must join before you'll receive `message event`
for that chat.

### `leave chat room` ✅

```js
socket.emit("leave chat room", { chatId: 5 }, (ack) => {
  // { left: 5 }
});
```

### `typing` ✅

Fire-and-forget (no ack). Participant-checked the same way as `join chat
room` — non-participants are silently ignored.

```js
socket.emit("typing", { chatId: 5, isTyping: true });  // started typing
socket.emit("typing", { chatId: 5, isTyping: false }); // stopped typing
```

Broadcasts to everyone else in `chat-<chatId>` **except the sender**
(`socket.to()`, not `io.to()`) — you never see your own typing event echoed
back. `isTyping` defaults to `true` if omitted, so the same event name
covers both start and stop; the client decides when to emit `false` (e.g. on
blur or after sending).

---

## 3. Server → client events

### `message event` ✅

Broadcast to room `chat-<chatId>` whenever a message is created via
bulk-forward (§6). Payload is the raw `Message` row (id, chatId, senderId,
text, fileUrl, local_id, settings, createdAt, ...). Only reaches sockets
that have already joined `chat-<chatId>`.

### `message received` ✅

Sent **only to the recipient**, on their personal room `user-<recipientId>`
— separate from `message event`, and delivered even if they haven't joined
that chat's room yet (e.g. their chat list should update without the thread
being open).

```json
{ "chatId": 5, "message": { "id": 12, "text": "...", "senderId": 2, "...": "..." } }
```

Use `message event` for "append this to the open thread" and
`message received` for "update the chat list / show a badge."

### `chat request` ✅

Broadcast to room `user-<requesteeId>` when someone calls
`POST /api/chat/request`.

```json
{ "chatId": 5, "fromUserId": 2 }
```

### `upload-progress` / `upload-complete` / `upload-error` ✅

Unrelated to chat — these belong to the file-upload namespace
([socket/streamUploadSocket.js](../socket/streamUploadSocket.js), connect to
`/upload` instead of `/`). Not covered further here.

---

## 4. Friends → chat creation ✅

`GET /api/user/:userId/friend/:status` — `status` is `add` or `remove`.

Adding a friend is **immediate and one-sided**: no request/accept/reject.

```
GET /api/user/4/friend/add
Authorization: Bearer <jwt>
```

```json
{
  "chatId": 5,
  "chatCreated": true,
  "alreadyFriend": false,
  "message": "Friend added and chat created.",
  "user": { "id": 4, "...": "full profile" }
}
```

- If the other user already added you, the existing chat is reused
  (`chatCreated: false`) instead of creating a duplicate.
- `GET /api/user/4/friend/remove` removes only your own entry — the other
  user keeps you in their list, and the chat/messages are untouched.
- Self-add and unknown-user return `400`/`404` respectively.

Controller: [UserProfileController.js:108](../controllers/UserProfileController.js#L108)
Service: [UserProfileService.js:237](../services/UserProfileService.js#L237)

---

## 5. Checking friend/chat state ✅

`GET /api/user/:userId/friend-chat-status`

`createFriendship` (§4) always creates-or-reuses the chat alongside the
friend row, so "friend but no chat" shouldn't happen through that path going
forward. This endpoint exists to detect it anyway — friend rows written
before that fix, by a seed script, or by any other path could still be
missing a chat.

```
GET /api/user/3/friend-chat-status
Authorization: Bearer <jwt>
```

```json
{
  "isFriend": true,
  "isMutualFriend": false,
  "hasChat": false,
  "chatId": null,
  "needsChatRepair": true
}
```

- `isFriend` — do **you** have a directed friend row pointing at them
  (friendship is one-sided; see §4).
- `isMutualFriend` — true only if they've also added you.
- `hasChat` / `chatId` — whether the shared chat row exists.
- `needsChatRepair` — `isFriend && !hasChat`. If true, fix it by calling
  `GET /api/user/:userId/friend/add` again — it's idempotent
  (`alreadyFriend: true`) and will create-or-reuse the chat without touching
  the existing friend row.

Read-only; unknown `userId` returns `404`.

Controller: [UserProfileController.js](../controllers/UserProfileController.js) (`getFriendChatStatus`)
Service: [UserProfileService.js](../services/UserProfileService.js) (`getFriendChatStatus`)

---

## 6. Sending a message ✅

**There is still no plain "send one text message" endpoint** — bulk-forward
is the only write path to the `messages` table, used for both single
messages and multi-file forwards. It used to reject every real
`multipart/form-data` client; that's now fixed.

### `POST /api/chat/bulk-forward`

`multipart/form-data`, fields:
- `recipientId` — the other user's id
- `payload` — a JSON array, **sent as a string field** (the normal way any
  `multipart/form-data` client sends structured data —
  `JSON.stringify([...])`). The server parses it with `JSON.parse` if it
  arrives as a string. An empty/non-array payload returns `400`, not a hang.
- `files` — 0+ file fields, uploaded to Spaces/S3, matched into `payload`
  entries by `index` / `thumbnail_index`.

```js
const form = new FormData();
form.append("recipientId", "3");
form.append("payload", JSON.stringify([{ text: "hello" }]));
// form.append("files", fileBlob); // optional
await fetch("/api/chat/bulk-forward", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

What it does: `findOrCreateChat(userId, recipientId)`, uploads any files,
bulk-inserts messages, stamps `lastMessage`/`lastMessageAt` on the chat
(§7), emits `message event` to `chat-<chatId>` and `message received` to
`user-<recipientId>` (§3). Verified end-to-end against the droplet with a
real stringified-payload request.

---

## 7. Chat list: last message & ordering ✅

`GET /api/chat/` (§9 table) now includes, per conversation:

```json
{
  "id": 3,
  "chatId": 4,
  "lastMessage": "hello world",
  "lastMessageAt": "2026-07-28T12:06:26.000Z",
  "createdAt": "2026-07-27T11:17:03.000Z",
  "updatedAt": "2026-07-28T12:06:26.000Z",
  "...": "rest of the contact profile fields"
}
```

- `lastMessage` / `lastMessageAt` are columns on `chats`
  ([models/chat.js](../models/chat.js)), stamped every time
  `bulk-forward` (§6) creates messages. `null` until the first message.
- File-only messages (no `text`) store `"📎 Attachment"` as the preview.
- `updatedAt` on the chat is bumped by the same write, so it now reflects
  last activity, not just chat creation.
- The list is sorted `updatedAt DESC` — most recently active conversation
  first. Chats with no messages yet sort by their creation time.

---

## 8. Reading messages ✅

`GET /api/chat/:chatId/messages?page=1&pageSize=20&messageId=<optional>`

- Without `messageId`: paginated, starting from your unread cursor.
- With `messageId`: delta sync — everything with `id > messageId`, no
  pagination.
- **Side effect:** calling this advances your `lastRead*` cursor on the chat
  to the newest message returned. A GET is not read-only here.

```json
{
  "total": 42,
  "totalPages": 3,
  "currentPage": 1,
  "messages": [ { "id": 10, "text": "...", "replyTo": null, "PaymentRequest": null } ]
}
```

---

## 9. Other REST routes (chat-adjacent)

| Route | Method | Notes |
|---|---|---|
| `/api/chat/` | GET | List your conversations (bidirectional) |
| `/api/chat/` | POST | `{ requesteeId }` → `{ isFriend, isFavourite }` for one contact |
| `/api/chat/invite` | POST | Legacy invite flow, separate from friend-add in §4 |
| `/api/chat/cancel-invite` | POST | Cancels the above |
| `/api/chat/update-friend` | PUT | Per-chat contact overrides (nickname, pic, etc.) |
| `/api/chat/request` | POST | `{ requesteeId }` → creates chat, emits `chat request` |
| `/api/chat/:chatId/delete` | POST | Hard-deletes chat + messages + payment requests |
| `/api/chat/transactions` | GET | Payment history between users |
| `/api/chat/request-payment` | POST | Create a pending payment request |
| `/api/chat/create-payment` | POST | Immediately execute a wallet transfer |
| `/api/chat/decrease-payment` / `/add-payment` | POST | Admin-only wallet adjustments |

Full route list: [routes/chatRoutes.js](../routes/chatRoutes.js)

---

## 10. Minimal connect + join example

```js
import { io } from "socket.io-client";

const socket = io("http://167.71.209.170:5001", {
  path: "/socket.io",
  auth: { token },
  transports: ["websocket"],
});

socket.on("connect", () => {
  socket.emit("join chat room", { chatId }, (ack) => {
    if (ack.error) return console.error(ack.error);
    console.log("joined", ack.joined);
  });
});

socket.on("message event", (msg) => {
  // append msg to the open thread
});

socket.on("message received", ({ chatId, message }) => {
  // update chat list preview / unread badge, even if this thread isn't open
});

socket.on("typing", ({ chatId, userId, isTyping }) => {
  // show/hide "typing..." indicator for that chat
});

socket.on("chat request", ({ chatId, fromUserId }) => {
  // someone wants to chat — refresh conversation list
});

// while composing:
socket.emit("typing", { chatId, isTyping: true });
// on blur / after send:
socket.emit("typing", { chatId, isTyping: false });
```

Full flow today: create the chat via friend-add (§4, verify with §5 if
unsure), send messages via bulk-forward (§6), read history via GET messages
(§8), and the chat list (§9) carries `lastMessage`/`lastMessageAt` sorted by
recent activity.
