# Chat Socket — Frontend Reference

Everything below reflects what's actually implemented in
[socket/chatSocket.js](../socket/chatSocket.js) and
[config/socket.js](../config/socket.js) right now. There is **no message
persistence yet** — no `messages` table, no "send message" event. This
covers connection, rooms, and the typing indicator only.

Status key: ✅ implemented and tested · 🚧 not built yet.

---

## 1. Connecting ✅

```js
import { io } from "socket.io-client";

const socket = io("http://<host>:<port>", {
  path: "/socket.io",
  auth: { token: "<jwt>" }, // must be auth.token, not a query param
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("connect failed:", err.message); // "Missing token" | "Invalid or expired token"
});
```

- Same JWT as REST: `{ userId, tokenVersion, ... }` signed with `JWT_SECRET_KEY`.
- Also accepted: an `Authorization: Bearer <jwt>` header on the handshake,
  if your client can't set `auth`.
- Handshake is rejected outright (`connect_error`) if the token is missing
  or invalid — no anonymous connections.

### What happens automatically on connect

1. You're joined to room `user-<yourUserId>` — reserved for future
   account-level pushes. Nothing uses it yet.
2. **You're auto-joined to `chat-<id>` for every chat you're currently a
   member of** (looked up from `chat_members` at connect time). This means
   `typing` starts working the moment you connect — you never have to call
   `join chat room` manually for chats that already existed before you
   connected.
3. If a **new** chat is created (direct, group, service, or order chat —
   any of the `POST /api/chat/...` endpoints) while you're already
   connected, the server proactively moves your socket into that
   `chat-<id>` room too (`joinUsersToChat` in `config/socket.js`). You do
   **not** need to reconnect or manually join after your own or someone
   else's REST call creates a chat you're a member of.
4. Your `memberStatus` flips to `"online"` on **every** chat you belong to,
   persisted to the DB, and a `user online` event is broadcast to each of
   those `chat-<id>` rooms (see §3). On disconnect the same happens in
   reverse with `user offline`. Multiple tabs/devices count as one online
   user — you only go offline once your *last* connected socket closes.

Net effect: as a frontend dev, you almost never need to call `join chat
room` by hand. It exists for explicit confirmation / reconnecting after a
manual `leave chat room`.

---

## 2. Client → server events

### `join chat room` ✅ (optional)

```js
socket.emit("join chat room", { chatId: 5 }, (ack) => {
  // success: { joined: 5 }
  // failure: { error: "Invalid chatId" }
  //       or { error: "Not a participant of this chat" }
});
```

Server checks you actually have a `chat_members` row for that `chatId`
before letting you in. Also accepts a bare chatId instead of an object:
`socket.emit("join chat room", 5, cb)`.

### `leave chat room` ✅

```js
socket.emit("leave chat room", { chatId: 5 }, (ack) => {
  // { left: 5 }
});
```

No participant check — leaving a room you're not in is a harmless no-op.
This only affects the socket room; it does **not** call the `POST
/api/chat/:id/leave` REST endpoint (which actually removes you as a member
— see §4).

### `typing` ✅

Fire-and-forget, no ack.

```js
socket.emit("typing", { chatId: 5, isTyping: true });  // started typing
socket.emit("typing", { chatId: 5, isTyping: false }); // stopped typing
```

- `isTyping` defaults to `true` if omitted.
- Silently dropped if you're not a participant of `chatId` (no error is
  sent back — it's fire-and-forget).
- Works as soon as you're connected — no `join chat room` needed first,
  per the auto-join behavior in §1.

---

## 3. Server → client events

### `typing` ✅

Broadcast to every other socket in `chat-<chatId>` — **never echoed back
to the sender** (`socket.to()`, not `io.to()`).

```js
socket.on("typing", ({ chatId, userId, isTyping }) => {
  // userId is who is typing — show/hide the indicator for that chat
});
```

```json
{ "chatId": 5, "userId": 2, "isTyping": true }
```

### `user online` / `user offline` ✅

Broadcast (via `io.to()`, so it **does** reach the user who just
connected/disconnected on any of their other open sockets too — this isn't
sender-excluded like `typing`) to every `chat-<id>` room that user belongs
to, once per chat, whenever they go online or offline. Fires on the first
socket connecting (online) and the last socket disconnecting (offline) —
opening a second tab does not re-fire `user online`.

```js
socket.on("user online", ({ userId, chatId, memberStatus }) => {
  // memberStatus is always "online" here
});
socket.on("user offline", ({ userId, chatId, memberStatus }) => {
  // memberStatus is always "offline" here
});
```

```json
{ "userId": 2, "chatId": 5, "memberStatus": "online" }
```

This also persists: `GET /api/chat/:id` and `GET /api/chat` (list) reflect
the live status in `statusMembers`:

```json
"statusMembers": [
  { "userId": 2, "updatedAt": 1732000500, "memberStatus": "online" },
  { "userId": 3, "updatedAt": 1731999000, "memberStatus": "offline" }
]
```

`updatedAt` is a unix timestamp (seconds) of the last online/offline
transition for that member, `null` if they've never connected. So a
newly-opened chat screen can render correct presence from the REST
response alone, then keep it live via the `user online`/`user offline`
events above — no need to wait for a socket round-trip just to know who's
currently online.

### `connect_error` ✅

Standard Socket.IO event, fired instead of `connect` when the JWT is
missing/invalid. See §1.

---

## 4. Not built yet 🚧

These would normally live in a chat socket doc but don't exist in this
codebase yet — don't wire a client up expecting them:

- **No message events** (`message event`, `message received`, or any
  send/receive-message socket flow) — there is no `messages` table.
- **No `chat request` / friend-add push event.**

Ask for these explicitly when you're ready to build messaging — the room
plumbing above (auth, auto-join, `chat-<id>` rooms) is what they'll be
built on top of.

---

## 5. Minimal end-to-end example

```js
import { io } from "socket.io-client";

const socket = io("http://<host>:<port>", {
  path: "/socket.io",
  auth: { token },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("connected — auto-joined to all my chat rooms");
});

socket.on("typing", ({ chatId, userId, isTyping }) => {
  updateTypingIndicator(chatId, userId, isTyping);
});

socket.on("user online", ({ chatId, userId }) => {
  updatePresence(chatId, userId, "online");
});
socket.on("user offline", ({ chatId, userId }) => {
  updatePresence(chatId, userId, "offline");
});

// while composing in chat 5:
inputEl.addEventListener("input", () => {
  socket.emit("typing", { chatId: 5, isTyping: true });
});
inputEl.addEventListener("blur", () => {
  socket.emit("typing", { chatId: 5, isTyping: false });
});

// optional explicit join, e.g. after navigating into a chat screen
socket.emit("join chat room", { chatId: 5 }, (ack) => {
  if (ack.error) console.error(ack.error);
});
```

---

## 6. Related REST endpoints (chat membership, not covered above)

The socket layer reacts to chats that already exist — chats themselves are
created/managed over REST, under `/api/chat` (auth: `Bearer <jwt>`,
[routes/chatRoutes.js](../routes/chatRoutes.js)):

| Route | Method | Notes |
|---|---|---|
| `/api/chat/` | GET | List your chats (`?archived=true` for archived) |
| `/api/chat/:id` | GET | Fetch one chat |
| `/api/chat/direct` | POST | `{ userId }` → create/reuse 1:1 chat |
| `/api/chat/group` | POST | `{ groupName, groupImage?, memberIds[], lockSettings? }` |
| `/api/chat/service` | POST | `{ serviceId, teamId?, ownerId, requestSubject?, requestDesc? }` |
| `/api/chat/order` | POST | `{ orderId, ownerId, services[] }` — bundles multiple services |
| `/api/chat/:id/members` | POST | `{ memberIds[] }` — add members (also live-joins their sockets) |
| `/api/chat/:id/members/:userId` | DELETE | Remove a member |
| `/api/chat/:id/leave` | POST | Leave; auto-promotes new admin if you were admin |
| `/api/chat/:id/favourite` \| `/archive` \| `/block` | PUT | `{ isFavourite\|isArchived\|isBlocked: bool }` |
| `/api/chat/:id/read` | PUT | Reset your unread counter |
| `/api/chat/:id/settings` | PUT | Update group name/image/AI/lock settings |
| `/api/chat/:id` | DELETE | Delete chat entirely |

Every creation/add-member endpoint above triggers `joinUsersToChat`
server-side, so already-connected sockets don't need to reconnect to start
receiving `typing` in a chat they were just added to.
