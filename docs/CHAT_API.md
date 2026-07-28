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

---

## 3. Server → client events

### `message event` ✅ (emitted, but see §6 for the only way to trigger it)

Broadcast to room `chat-<chatId>` whenever a message is created via
bulk-forward. Payload is the raw `Message` row (id, chatId, senderId, text,
fileUrl, local_id, settings, createdAt, ...).

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

## 6. Sending a message ⚠️ **broken for real clients**

**There is no plain "send one text message" endpoint.** The only write path
to the `messages` table is bulk-forward, and it is broken for the way any
real multipart client (mobile app, browser `FormData`) actually calls it.

### `POST /api/chat/bulk-forward`

`multipart/form-data`, fields:
- `recipientId` — the other user's id
- `payload` — **must currently be a real JSON array, not a string.** The
  server does `payload.map(...)` directly with no `JSON.parse`. Any client
  that sends `payload` as `JSON.stringify([...])` (the only way a
  `multipart/form-data` field can carry structured data) gets:

  ```
  TypeError: payload.map is not a function
  ```

  and the request **hangs with no response** — the throw isn't caught, so
  Express never sends anything back. This was confirmed against the droplet;
  it's not a doc gap, it's a live bug in
  [ChatService.js:490](../services/ChatService.js#L490) /
  [ChatController.js:442](../controllers/ChatController.js#L442).
- `files` — 0+ file fields, uploaded to Spaces/S3, matched into `payload`
  entries by `index` / `thumbnail_index`.

**Until that's fixed**, the only way to hit this endpoint successfully is
from a client that can put a real array in a JSON body — i.e. not proper
`multipart/form-data` at all. This route is not usable from a normal mobile
or web client today. Treat this as a known gap, not something to build
around in a frontend client.

What it does when it works: `findOrCreateChat(userId, recipientId)`, uploads
any files, bulk-inserts messages, emits `message event` to `chat-<chatId>`.

---

## 7. Reading messages ✅

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

## 8. Other REST routes (chat-adjacent)

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

## 9. Minimal connect + join example

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
  // append msg to the thread
});

socket.on("chat request", ({ chatId, fromUserId }) => {
  // someone wants to chat — refresh conversation list
});
```

To get messages flowing today: create the chat via friend-add (§4, verify
with §5 if unsure), fetch history via GET messages (§7). Sending new
messages is blocked on the bulk-forward bug in §6 until that's fixed
server-side.
