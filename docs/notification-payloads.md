# Notification Payload Reference (for app-side routing)

## 1. GET /api/notification/my — response shape

```json
{
  "success": true,
  "data": [ <Notification>, ... ],
  "unreadCount": 3,
  "pagination": {            // only when ?pagination=true
    "currentPage": 1,
    "totalPages": 2,
    "totalItems": 25,
    "limit": 20
  }
}
```

Fetched notifications are auto-marked read (badge clears on the next fetch).
Pass `?autoRead=false` to skip that. Filters: `?unread=true`, `?type=WITHDRAW_PAID`.

### Notification object

```json
{
  "id": 12,
  "userId": 4,               // recipient
  "actorId": 1,              // who did the action (null if system)
  "type": "WITHDRAW_PAID",   // see the type table below
  "title": "Withdraw Paid",
  "message": "Your withdraw request #6 of 100 USD has been paid (paid amount: 90 USD). Note: paid via bank",
  "entityType": "WITHDRAW",  // RECEIPT | WITHDRAW | ORDER
  "entityId": 6,             // id to open on tap
  "data": { ... },           // type-specific details, table below
  "isRead": false,
  "createdAt": "2026-07-11T12:00:00.000Z",
  "updatedAt": "2026-07-11T12:00:00.000Z",
  "actor": {                 // null if actorId is null
    "id": 1,
    "firstName": "...",
    "lastName": "...",
    "username": "...",
    "email": "...",
    "profilePic": "..."
  }
}
```

## 2. Routing rule (app side)

| entityType | open screen | with id |
|---|---|---|
| `RECEIPT` | Receipt detail | `entityId` |
| `WITHDRAW` | Withdraw detail | `entityId` |
| `ORDER` | Order detail | `entityId` |

Staff-only types (show in admin app section): `RECEIPT_CREATED`, `WITHDRAW_CREATED`.
Everything else goes to the acting user / service owner / buyer.

## 3. All types with example title, message, and `data`

### Receipts

| type | sent to | title |
|---|---|---|
| `RECEIPT_CREATED` | all staff | New Receipt Request |
| `RECEIPT_APPROVED` | receipt owner | Receipt Approved |
| `RECEIPT_REJECTED` | receipt owner | Receipt Rejected |
| `RECEIPT_LOCKED` | receipt owner | Funds Locked |
| `RECEIPT_UNLOCKED` | receipt owner | Funds Unlocked |
| `RECEIPT_UPDATED` (or `RECEIPT_<STATUS>` when admin edit changes status) | receipt owner | Receipt Updated |
| `RECEIPT_DELETED` | receipt owner | Receipt Deleted |

`data` examples:

```jsonc
// RECEIPT_CREATED (staff)
{ "amount": "300", "currency": "USD", "walletType": "PERSONAL",
  "creatorName": "hashir mehmood", "note": "test funding", "status": "pending" }

// RECEIPT_APPROVED
{ "amount": "300", "creditedAmount": "300", "currency": "USD",
  "walletType": "PERSONAL", "isLock": false, "status": "approved", "adminNote": "ok" }

// RECEIPT_REJECTED
{ "amount": "300", "currency": "USD", "walletType": "PERSONAL", "status": "rejected" }

// RECEIPT_LOCKED
{ "lockedAmount": "300", "currency": "USD", "walletType": "PERSONAL", "adminNote": "lock note" }

// RECEIPT_UNLOCKED (cross-currency includes original amount/currency)
{ "unlockedAmount": "2160", "currency": "CNY", "originalAmount": "300",
  "originalCurrency": "USD", "walletType": "PERSONAL", "adminNote": "unlock note" }

// RECEIPT_UPDATED / RECEIPT_<STATUS> (admin edit)
{ "amount": "300", "newAmount": "280", "currency": "USD",
  "walletType": "PERSONAL", "status": "approved" }

// RECEIPT_DELETED
{ "amount": "300", "currency": "USD", "walletType": "PERSONAL", "status": "pending" }
```

### Withdraws

Withdraw actions do NOT send notifications (removed by request on 2026-07-11).

### Service orders

| type | sent to | title |
|---|---|---|
| `SERVICE_ORDER_CREATED` | service owner | New Order Received |
| `SERVICE_ORDER_PURCHASED` | service owner | Payment Received / New Order Purchased |
| `SERVICE_ORDER_TOPUP` | service owner | Additional Payment Received |
| `ORDER_PAYMENT_RECORDED` | order buyer | Payment Recorded |

```jsonc
// SERVICE_ORDER_CREATED / PURCHASED / TOPUP (owner; amount = owner's share)
{ "amount": "250", "buyerName": "hashir mehmood", "services": ["Logo Design"] }

// ORDER_PAYMENT_RECORDED (buyer; admin recorded an offline payment)
{ "amount": "50", "recordType": "order_payment", "serviceOrderId": null, "note": "cash received" }
```

## 3b. COMPLETE type list (all 17 — for app routing)

| # | type | entityType | recipient | fired when |
|---|---|---|---|---|
| 1 | `RECEIPT_CREATED` | RECEIPT | all staff | user creates a receipt |
| 2 | `RECEIPT_APPROVED` | RECEIPT | receipt owner | admin approves (approve endpoint OR admin edit sets status=approved) |
| 3 | `RECEIPT_REJECTED` | RECEIPT | receipt owner | admin rejects (reject endpoint OR admin edit sets status=rejected) |
| 4 | `RECEIPT_PENDING` | RECEIPT | receipt owner | admin edit sets status back to pending |
| 5 | `RECEIPT_HOLD` | RECEIPT | receipt owner | admin edit sets status to hold |
| 6 | `RECEIPT_UPDATED` | RECEIPT | receipt owner | admin edit without status change (e.g. newAmount) |
| 7 | `RECEIPT_LOCKED` | RECEIPT | receipt owner | admin locks funds |
| 8 | `RECEIPT_UNLOCKED` | RECEIPT | receipt owner | admin unlocks funds (maybe converted currency) |
| 9 | `RECEIPT_DELETED` | RECEIPT | receipt owner | admin deletes (single or bulk) |
| 10 | `SERVICE_ORDER_CREATED` | ORDER | service owner | buyer places an order containing their service |
| 11 | `SERVICE_ORDER_PURCHASED` | ORDER | service owner | buyer pays (confirm order or one-shot checkout) |
| 12 | `SERVICE_ORDER_TOPUP` | ORDER | service owner | buyer pays an additional amount |
| 13 | `ORDER_PAYMENT_RECORDED` | ORDER | order buyer | admin records an offline payment on the order |

Withdraw types (`WITHDRAW_*`) were removed — withdraw actions no longer notify anyone.

Routing tip: don't switch on all 17 — switch on `entityType` (3 cases) and use
`type` only for icons/colors/filtering. Unknown future types then route correctly by default.

## 4. FCM push payload (what arrives on the phone)

```jsonc
{
  "notification": { "title": "Withdraw Paid", "body": "<same as message>" },
  "data": {
    // FCM v1 rule: every value is a STRING
    "type": "WITHDRAW_PAID",
    "entityType": "WITHDRAW",
    "entityId": "6",
    "amount": "100",
    "paidAmount": "90",
    "currency": "USD",
    "walletType": "PERSONAL",
    "adminStatus": "paid",
    "adminNote": "paid via bank"
    // booleans arrive as "true"/"false", arrays as JSON strings
  }
}
```

On tap: read `data.entityType` + `data.entityId` (parse int) and navigate per the routing table.

## 5. Other management endpoints

| Call | Success response |
|---|---|
| `GET /notification/my/unread-count` | `{ "success": true, "unreadCount": 3 }` |
| `PUT /notification/my/:id/read` | `{ "success": true, "data": <Notification> }` |
| `PUT /notification/my/read-all` | `{ "success": true, "message": "3 notification(s) marked as read." }` |
| `DELETE /notification/my/:id` | `{ "success": true, "message": "Notification deleted successfully." }` |
| `DELETE /notification/my/all` | `{ "success": true, "message": "5 notification(s) deleted successfully." }` |
| `POST /auth/update-fcm` (body `{"fcmToken":"..."}`) | `{ "user": <User> }` |
| `POST /auth/logout` | `{ "success": true, "message": "Logged out successfully." }` |

Errors everywhere: `404 { "success": false, "error": "Notification not found." }`,
`500 { "success": false, "error": "Server error. Please try again later." }`.
