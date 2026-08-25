# Chat Socket — Frontend Reference

Everything below reflects what's actually implemented in
[socket/chatSocket.js](../socket/chatSocket.js),
[socket/streamUploadSocket.js](../socket/streamUploadSocket.js),
[services/MessageService.js](../services/MessageService.js),
[config/socket.js](../config/socket.js), and (for the payment
accept/reject → `message updated` trigger in §3)
[controllers/PaymentController.js](../controllers/PaymentController.js) /
[services/PaymentService.js](../services/PaymentService.js) right now.

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
— see §7).

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

### `send message` ✅

This is how messages are created — there is **no REST POST for sending**.
Ack-based: the server persists the message and acks back the full row, so
the client can flip its optimistic "sending" bubble to "sent" using the
real server-assigned `id`.

```js
socket.emit(
  "send message",
  {
    chatId: 5,
    localId: "client-generated-uuid", // for retry de-dup, see below
    messageType: "text", // "text" | "image" | "video" | "audio" | "file" |
                          // "contact" | "payment" | "order" | "address" |
                          // "bankCard" | "shortList" | "balanceSheet"
    message: "Sure, I'll send the invoice shortly.",

    // optional, depending on messageType:
    replyToMessageId: 12,
    mediaUrl: "https://cdn.example.com/media/img55_full.jpg",
    thumbnailUrl: "https://cdn.example.com/thumbs/img55.jpg",
    thumbnailBlurHash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4",
    contactCardId: 45, // a userId, shares that user as a contact card
    mentionUserIds: [12, 45],
    hashtags: ["#urgent"],

    // reference attachments — id only, full record is snapshotted into
    // the response (§ "media/contact/reply/payment and friends" below):
    paymentRequestId: 9, // must already exist — create it first via
                         // POST /api/payment/request-payment (asking to be
                         // paid) or POST /api/payment/create-payment
                         // (an already-completed direct transfer)
    orderId: 482,
    addressId: 3,
    bankAccountId: 7,
    shortListId: 2,
    ledgerId: 14, // "balanceSheet" in the response
  },
  (ack) => {
    if (ack.error) return console.error(ack.error);
    replaceOptimisticMessage(payload.localId, ack.message);
  }
);
```

- **`localId` de-dup**: if the ack is dropped (network blip) and your client
  retries the exact same `chatId` + `localId`, the server returns the
  *already-created* message instead of creating a duplicate, and does
  **not** re-broadcast it a second time. Always generate a fresh `localId`
  per logical message (e.g. a UUID), reuse it only on retry of that same
  send.
- Rejected with `{ error: "Not a participant of this chat" }` if you're not
  a member of `chatId`.
- The response `message` object is the same shape documented in §3's
  `message` event below.
- **Every message is created with `isUploading: 1`**, regardless of
  `messageType` — even a plain text message. This is not tied to the
  `/upload` namespace (§4) or to whether `mediaUrl` is set; it's a flag on
  the message row itself. Call `PUT
  /api/chat/messages/:messageId/uploaded` (§7) once you're ready to clear
  it — see the `message updated` event in §3 for how the change reaches
  other participants live.

### `mark message seen` ✅

The frontend decides when a message counts as "read" (e.g. scrolled into
view, chat screen focused) and explicitly emits this — there is **no
automatic server-side detection** based on room membership or the chat
being open. Receiving the `message` event does **not** imply it's seen.

```js
socket.emit(
  "mark message seen",
  { chatId: 5, messageId: 12 },
  // or: { chatId: 5, messageIds: [12, 13, 14] }
  (ack) => {
    if (ack.error) return console.error(ack.error);
    // { seen: [12], unreadCount: 0, latestMessage: { id, message, ... full shape } }
    updateUnreadBadge(5, ack.unreadCount);
    updateChatListPreview(5, ack.latestMessage);
  }
);
```

- Also resets your unread counter on the chat to `0` — same effect as
  `PUT /:id/read` (§7), no need to call both. **The ack includes the real
  `unreadCount`** (always `0` today — marking anything seen resets the
  whole chat's counter, it isn't a precise per-message decrement, see §5
  for the caveat on this) so you don't need a separate fetch just to
  update the badge.
- **The ack also includes `latestMessage`** — the chat's single most
  recent message, in the full shape documented under the `message` event
  below (media/reply/payment/etc., not just `Chat.lastMessage`'s plain
  preview string used in the chat list). `null` if the chat somehow has no
  messages. This is the *chat's* latest message, not necessarily the one(s)
  you just marked seen — useful for refreshing a chat-list row or
  "jump to latest" UI from this one event instead of a separate fetch.
- Rejected with `{ error: "Not a participant of this chat" }` if you're not
  a member of `chatId`.
- Broadcasts `message seen` (§3) to the whole room, **including your own
  other tabs** (`io.to()`, not sender-excluded) — so read state (and your
  `unreadCount`) stays in sync across your own devices too, not just
  visible to the other participant.

---

## 3. Server → client events

### `message` ✅

Broadcast to everyone else in `chat-<chatId>` (`socket.to()` — the sender
does **not** get this; they already have the row from their `send message`
ack). Also bumps `Chat.lastMessage`/`lastMessageAt` and **increments**
`ChatMember.unreadCount` for every other participant server-side, so
`GET /api/chat` chat-list previews and unread badges update automatically
on the *incoming* side — no separate call needed just to see the badge go
up.

**The sender is automatically included in `seenMessagePersons` from the
moment the message is created** — sending a message counts as having seen
it, no separate `mark message seen` call needed for your own messages.
Every other recipient only appears in that array once they explicitly emit
`mark message seen` (§2).

⚠️ **Getting the counter back to 0 is not automatic — it requires the
client to act.** The server has no way to know a chat screen is open or a
message is visually on-screen; receiving this `message` event does not by
itself mark anything read or touch `unreadCount`. If the recipient's chat
screen is genuinely open right now, **your client is responsible for
immediately emitting `mark message seen` (§2) for that message** — do it
unconditionally in your `message` handler whenever the chat this message
belongs to is the one currently open/focused. Skipping this means the
unread badge stays incremented even though the user is looking straight at
the message.

```js
socket.on("message", (message) => {
  appendToOpenThread(message);

  // REQUIRED for the unread badge to behave correctly: if the chat this
  // message belongs to is the one currently open on screen, mark it seen
  // right away. Without this call unreadCount keeps climbing even while
  // the user is actively looking at the conversation.
  if (message.chat_id === currentlyOpenChatId) {
    socket.emit("mark message seen", {
      chatId: message.chat_id,
      messageId: message.id,
    });
  }
});
```

Full message shape (nested sub-objects are `null` when not applicable to
that message):

```json
{
  "id": 3022,
  "chat_id": 5,
  "message_sender_id": 12,
  "message_sender_name": "Ayesha Khan",
  "message_sender_imageUrl": "https://cdn.example.com/users/12.png",
  "message_type": "image",
  "message": "Here's the reference photo",
  "isForward": 0,
  "isEdit": 0,
  "isUploading": 1,
  "uploadingPercentage": 0,
  "hashtags": ["#urgent"],
  "created_at": 1732000560000,
  "updated_at": 1732000560000,

  "media": {
    "type": "image",
    "mediaUrl": "https://cdn.example.com/media/img55_full.jpg",
    "thumbnailUrl": "https://cdn.example.com/thumbs/img55.jpg"
  },
  "contact": null,
  "reply": {
    "parentMessageId": 3021,
    "parentMessage": "Sure, I'll send the invoice shortly.",
    "replyType": "text",
    "replyerId": 45,
    "replyerName": "Bilal Ahmed"
  },
  "payment": null,
  "order": null,
  "address": null,
  "bankCard": null,
  "shortList": null,
  "balanceSheet": null,

  "mention_members": [
    { "memberId": 45, "memberName": "Bilal Ahmed", "memberImage": "...", "memberPhone": "..." }
  ],
  "seenMessagePersons": [12],
  "deleteMessagePersonsIds": [],
  "isDeletedForViewer": false
}
```

`media.type` is just `messageType` echoed back (`"image"` / `"video"` /
`"audio"` / `"file"`) — `thumbnailBlurHash`, `isUploading`, and
`uploadingPercentage` are **not** duplicated inside `media`; use the
top-level fields of the same name on the message itself.

`payment` (when `messageType: "payment"`) looks like:

```json
{
  "payment": {
    "paymentRequestId": 9,
    "amount": "50.00",
    "currency": "USD",
    "note": "Logo design deposit",
    "status": "pending",
    "type": "paymentRequest",
    "requesterId": 12,
    "requesteeId": 45
  }
}
```

- `note` is the payment's description text (renamed from the old
  `description` key).
- `type` is one of `"paymentSend"`, `"paymentReceived"`, or
  `"paymentRequest"`, and **is computed per viewer** — the same underlying
  row can format differently depending on who's asking:
  - Created via `POST /api/payment/create-payment` (a direct,
    already-completed transfer) → `type` is `"paymentSend"` if you
    (`viewerUserId`) are `requesterId` (the payer), `"paymentReceived"` if
    you're `requesteeId` (the payee). `status` is `"accepted"` from the
    moment it's created — there's no pending state for a direct send.
  - Created via `POST /api/payment/request-payment` (asking someone to pay
    you) → `type` is always `"paymentRequest"`, for **both** sides, no
    matter what `status` is. `status` starts `"pending"` and moves to
    `"accepted"` or `"rejected"` once the requestee calls
    `PUT /api/payment/request-payment/:id/accept` or `/reject` — see the
    `message updated` section below for how that update reaches the chat
    live.

`order` / `address` / `bankCard` / `shortList` / `balanceSheet` are
**reference-only snapshots** of the existing `Order` / `Address` /
`BankAccount` / `ShortList` / `Ledger` records at the id you sent — sending
one doesn't create or modify anything in those tables, it's the same idea
as attaching `mediaUrl` to a message. `balanceSheet` maps to the `Ledger`
model (`GET /api/payment/ledgers`), not a separate table.

### `message updated` ✅

Broadcast to `chat-<chatId>` (`io.to()` — reaches everyone in the room,
including the message's own sender on their other tabs, not sender-excluded
like `message`). There's no generic "edit message" flow yet — two specific
things trigger it today:

1. **`PUT /api/chat/messages/:messageId/uploaded`** (§7) — clears
   `isUploading` and sets `uploadingPercentage`. Payload is the full message
   object (§3 `message` shape above) with `isUploading` now `0` and
   `uploadingPercentage` reflecting whatever was passed (defaults to `100`).
2. **`PUT /api/payment/request-payment/:id/accept`** or **`/:id/reject`**
   — whichever chat message was originally sent with that `paymentRequestId`
   (via `send message`, §2) gets re-formatted and re-broadcast, with
   `payment.status` now `"accepted"` or `"rejected"` (`payment.type` stays
   `"paymentRequest"` — see the `payment` sub-object notes above). If that
   `paymentRequestId` was never attached to any chat message (created over
   REST but never sent via `send message`), nothing is broadcast — there's
   no message row to update, and the REST response's own `message` field
   comes back `null` in that case.

```js
socket.on("message updated", (message) => {
  // full message shape, same as the "message" event — patch the
  // existing bubble in place using message.id, don't append a new one
  patchMessageInThread(message);
});
```

### `message seen` ✅

Broadcast to `chat-<chatId>` (`io.to()`, whole room including the reader's
own other tabs) whenever `mark message seen` (§2) is emitted by anyone in
the chat.

```js
socket.on("message seen", ({ chatId, messageIds, userId, unreadCount, latestMessage }) => {
  // userId is who just read these messages — update the
  // read-receipt/checkmark state on each message in messageIds
  messageIds.forEach((id) => markMessageAsReadInUi(id, userId));

  // unreadCount is USERID's own new count, not yours — only meaningful to
  // act on if userId === your own id (i.e. this fired from one of your
  // OTHER tabs, since the sender doesn't get sender-excluded here).
  if (userId === myOwnUserId) updateUnreadBadge(chatId, unreadCount);

  // latestMessage is chat-wide, not tied to who read what — safe to use
  // regardless of who userId is.
  updateChatListPreview(chatId, latestMessage);
});
```

```json
{
  "chatId": 5,
  "messageIds": [12, 13],
  "userId": 45,
  "unreadCount": 0,
  "latestMessage": { "id": 13, "message": "sounds good", "...": "full message shape, see the message event above" }
}
```

`unreadCount` belongs to **`userId`** (whoever just read the message), not
to you as the listener — check `userId === myOwnUserId` before using it,
otherwise you'll overwrite your own badge with someone else's count.
`latestMessage` has no such caveat — it's the chat's single most recent
message regardless of who's asking, `null` if the chat has none.

Aside from those two fields, this is a **thin event** — just ids for
`messageIds`, not a full message object per id. If you need the updated
`seenMessagePersons` array rendered for something other than the latest
message, patch it into your already-held copy locally, or re-fetch via
`GET /:chatId/messages` (§7) if you don't already have that message
client-side.

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

## 4. File upload (separate namespace) — how to get `mediaUrl`/`thumbnailUrl`

`send message` never uploads anything itself — you upload the file first,
get back a URL, then pass that URL into `mediaUrl`/`thumbnailUrl` on `send
message` (§2). Uploads go through a **separate namespace**,
[socket/streamUploadSocket.js](../socket/streamUploadSocket.js), not the
default `/` namespace everything else in this doc uses.

```js
const uploadSocket = io("http://<host>:<port>/upload", {
  path: "/socket.io",
  // no auth — see the warning below
});
```

⚠️ **This namespace has no authentication and no per-file size/type limit
enforced server-side** — unlike every other event in this doc, there is no
JWT check here at all. Don't treat it as hardened; this is a gap, not a
documented feature, flagged here so you don't assume it's protected.

Protocol — chunked, gzip-compressed per chunk, base64-encoded over the
wire, driven entirely by the client (server just assembles what it's told):

```js
function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

const fileId = crypto.randomUUID();
const chunkSize = 256 * 1024; // pick your own chunk size
const totalChunks = Math.ceil(file.size / chunkSize);

await emitAck(uploadSocket, "upload-start", {
  fileId,
  fileName: file.name,
  fileSize: file.size,
  fileHash: null, // unused server-side today, send whatever/omit
  totalChunks,
});

for (let i = 0; i < totalChunks; i++) {
  const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
  const gzipped = gzipSync(await chunk.arrayBuffer()); // client-side gzip required
  await emitAck(uploadSocket, "upload-chunk", {
    fileId,
    chunkIndex: i,
    chunkData: gzipped.toString("base64"),
    totalChunks,
  });
}

const result = await emitAck(uploadSocket, "upload-complete", { fileId });
// { success: true, url: "/uploads/1732000560000_photo.jpg", hash: "<sha256>" }
// url is a path relative to this server's origin, not a full URL — prefix
// it with the same <host>:<port> you connected to.
```

- **`upload-progress`** (server → client, on the same socket, no ack) fires
  after each accepted chunk: `{ fileId, progress, receivedChunks,
  totalChunks }` — `progress` is a 0–100 percentage of bytes uploaded.
- **`cancel-upload`**: `socket.emit("cancel-upload", { fileId })` —
  fire-and-forget, deletes the in-progress temp chunks server-side.
- Disconnecting mid-upload auto-cleans that socket's incomplete temp
  chunks — you don't need to explicitly cancel before closing the tab.
- `upload-complete` rejects with `{ error: "Missing N chunks (...)" }` if
  any `chunkIndex` never arrived — resend just the missing ones and retry
  `upload-complete`, or restart with a fresh `fileId`.
- There's no `thumbnailBlurHash` generation here — if you want one, compute
  it client-side (e.g. via `blurhash`) before calling `send message`.

---

## 5. Not built yet 🚧

These would normally live in a chat socket doc but don't exist in this
codebase yet — don't wire a client up expecting them:

- **No `chat request` / friend-add push event.**
- **No delivered/edit/delete socket events for per-user delete** — deleting
  a message for yourself (§7 `DELETE /messages/:messageId`) is REST-only,
  not broadcast. Read receipts ARE live now — see `mark message seen` (§2)
  / `message seen` (§3).
- **No auth on the `/upload` namespace** (§4) — anyone who can reach the
  server can upload files, there's no participant/chat check either since
  uploads aren't associated with a chat until you reference the resulting
  URL in `send message`.

Ask for these explicitly when you're ready to build them.

---

## 6. Minimal end-to-end example

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

socket.on("message", (message) => {
  appendToOpenThread(message);
  // REQUIRED so unreadCount goes back to 0 while the chat is open — see §3.
  if (message.chat_id === currentlyOpenChatId) {
    socket.emit("mark message seen", { chatId: message.chat_id, messageId: message.id });
  }
});

socket.on("message seen", ({ chatId, messageIds, userId }) => {
  messageIds.forEach((id) => markMessageAsReadInUi(id, userId));
});

// sending a message:
const localId = crypto.randomUUID();
socket.emit(
  "send message",
  { chatId: 5, localId, messageType: "text", message: "hey" },
  (ack) => {
    if (ack.error) return console.error(ack.error);
    replaceOptimisticMessage(localId, ack.message);
  }
);

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

## 7. Related REST endpoints (chat membership, not covered above)

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
| `/api/chat/:chatId/messages` | GET | `?page=1&pageSize=30` — paginated history, oldest→newest per page, your own soft-deletes excluded |
| `/api/chat/:chatId/messages/seen` | PUT | `{ messageIds[] }` — mark messages as read by you |
| `/api/chat/messages/:messageId/uploaded` | PUT | `{ uploadingPercentage? }` (default 100) — clears `isUploading`, broadcasts `message updated` (§3) |
| `/api/chat/messages/:messageId` | DELETE | `{ isDeleteAll? }` — delete for you only (or flag delete-for-everyone intent) |

Message **creation** is socket-only (§2 `send message`) — there is no
`POST /api/chat/:chatId/messages`.

Payment requests/sends themselves live under a separate router,
`/api/payment` ([routes/paymentRoutes.js](../routes/paymentRoutes.js),
[controllers/PaymentController.js](../controllers/PaymentController.js)),
not `/api/chat` — but two of its endpoints matter here because they trigger
`message updated` (§3) on whichever chat message references them:

| Route | Method | Notes |
|---|---|---|
| `/api/payment/request-payment` | POST | `{ requesteeId, amount, currency, description }` — creates a pending payment request (`kind: "request"`), no chat/participant check |
| `/api/payment/create-payment` | POST | `{ requesteeId, amount, currency, walletType, description }` — direct, already-completed transfer (`kind: "direct"`), no chat/participant check |
| `/api/payment/request-payment/:id/accept` | PUT | `{ walletType? }` (default `PERSONAL`) — requestee only, moves funds requestee → requester, `status: "accepted"` |
| `/api/payment/request-payment/:id/reject` | PUT | requestee only, `status: "rejected"`, no funds move |

Creating a payment request/send doesn't require a chat at all — it only
becomes visible in a chat once you separately `send message` with that
`paymentRequestId` (§2).

Every creation/add-member endpoint above triggers `joinUsersToChat`
server-side, so already-connected sockets don't need to reconnect to start
receiving `typing` in a chat they were just added to.
