# Product Orders API — Frontend Integration Guide

Base path: `{{baseUrl}}/product-orders`
Auth: every endpoint requires `Authorization: Bearer <token>`.

Converts a buyer's product cart ([docs/product-cart-api.md](product-cart-api.md)) into a real, paid order via wallet-to-wallet payment, tracks shipping status through delivery, and lets a shop owner add post-order charges (e.g. real shipping cost) that the buyer pays separately.

A Postman collection with every request + example responses is at `postman/product-apis.postman_collection.json`, folder **"7. Product Orders"**.

---

## 1. Core concept: parent order → shop-orders

A cart can contain products from **multiple shops**. Checkout doesn't produce one flat order — it produces a **parent order** (the checkout event, one wallet debit) that fans out into **one shop-order per shop**:

```
Checkout
  │
  ▼
Parent Order  #PO-...  (one wallet debit, one address, one delivery choice)
  │
  ├── Shop Order  #PO-...-1   (Shop A's items — its own status, its own payout)
  └── Shop Order  #PO-...-2   (Shop B's items — its own status, its own payout)
```

- **Parent order** (`ProductOrder`): `orderNo`, `userId` (buyer), `addressId`, `deliveryType`, `note`, `walletType`, `totalAmount` (sum of all its shop-orders). Has **no status of its own** — the buyer's UI should derive an overall picture from the statuses of its `shopOrders[]` (e.g. show "partially shipped" if one shop-order is `shipped` and another is still `confirmed`).
- **Shop order** (`ProductShopOrder`): the row a seller actually manages. Its own `status`, `subtotal`, `discountAmount`, `addOnAmount`, `chargesAmount`, `totalAmount`, `paidAmount`, and `items[]` (the line items from that shop).

**Who sees what:**
- Buyer's order list (`GET /product-orders`) → **parent orders**, each with `shopOrders[]` nested inside.
- Shop owner's order list (`GET /product-orders/shop/:shopId`) → **flat shop-orders** for that one shop only — never another shop's items, even from the same checkout.

---

## 2. Checkout

### `POST /product-orders/checkout`

```json
{
  "walletId": 16,
  "addressId": 12,
  "deliveryType": "standard",
  "note": "Leave at front desk"
}
```

| Field | Required | Notes |
|---|---|---|
| `walletId` | **yes** | The buyer's own wallet **row id** — not a `"PERSONAL"`/`"COMPANY"` string. A wallet row already encodes both its type and currency, so sending the id directly removes any ambiguity when a buyer holds multiple wallets of the same type in different currencies. Get the buyer's wallets from the existing wallet-list endpoint and let them pick one. |
| `addressId` | no | One address for the **whole** checkout (not per shop). Must belong to the requesting buyer. |
| `deliveryType` | no | Free-text string (e.g. `"standard"`, `"express"`) — not validated against a fixed list server-side. |
| `note` | no | Free-text note for the whole order. |

**What happens:** the buyer's current cart ([docs/product-cart-api.md](product-cart-api.md)) is grouped by shop, one shop-order is created per shop, the chosen wallet is debited **once** for the combined total, each shop's payout wallet is credited its own slice, product/variation stock is decremented and `soldQuantity` incremented, and the cart is cleared — all inside a single database transaction (all-or-nothing; if anything fails, nothing happens).

**Prices/discounts/add-ons are copied from the cart exactly as shown there — no re-validation at checkout.** Only stock is re-checked live (since two people could buy the last unit between add-to-cart and checkout).

**Response `201`:**
```json
{
  "success": true,
  "message": "Order placed",
  "order": {
    "id": 5,
    "orderNo": "PO-1784722354948-FLG4LI",
    "totalAmount": "50.00000000",
    "walletType": "PERSONAL",
    "address": { "...": "full address object" },
    "shopOrders": [
      {
        "id": 6,
        "orderNo": "PO-1784722354948-FLG4LI-1",
        "shopId": 54,
        "status": "confirmed",
        "totalAmount": "50.00000000",
        "paidAmount": "50.00000000",
        "items": [ { "...": "line items, same shape as a cart line" } ],
        "charges": [],
        "shop": { "id": 54, "name": "...", "profile_image": "...", "country": "..." }
      }
    ]
  }
}
```

**Errors to handle:**

| Status | Code | When |
|---|---|---|
| 400 | `EMPTY_CART` | Cart has no lines |
| 400 | `OUT_OF_STOCK` | A line's quantity now exceeds live stock |
| 402 | `NO_WALLET` | `walletId` doesn't exist or doesn't belong to this user |
| 402 | `INSUFFICIENT_BALANCE` | Combined total exceeds the wallet's balance — response includes `data: { required, available }` |
| 402 | `CURRENCY_MISMATCH` | A shop's payout wallet currency doesn't match the chosen wallet's currency — **checkout is rejected entirely, nothing is charged**. There is no automatic currency conversion in this version. |
| 404 | `ADDRESS_NOT_FOUND` | `addressId` given but doesn't belong to this buyer |
| 500 | `NO_PAYOUT_WALLET` | A shop has no payout wallet configured at all (seller-side setup issue, not something the buyer can fix) |

**Important — order matters here:** currency-mismatch and stock checks happen for **every** shop in the cart *before* any wallet is touched. So checkout either fully succeeds or fully fails — you'll never end up with money moved for some shops but not others.

---

## 3. Viewing orders

### `GET /product-orders` — buyer's order history (paginated)
```
GET /product-orders?page=1&limit=10
```
Returns parent orders, each with `shopOrders[]` nested, newest first.
```json
{ "success": true, "total": 12, "totalPages": 2, "currentPage": 1, "orders": [ { "...": "parent order" } ] }
```

### `GET /product-orders/:orderId` — one parent order
Buyer-scoped — 404 if it's not this user's order.

### `GET /product-orders/shop/:shopId` — shop owner's order queue (paginated)
```
GET /product-orders/shop/54?page=1&limit=10&status=confirmed
```
Owner-or-admin only (403 otherwise). Optional `status` query filters to exactly one status. This is the endpoint for a seller's "Orders" dashboard.

### `GET /product-orders/shop-orders/:shopOrderId` — one shop-order
Viewable by the buyer who placed it, the shop owner, or an admin.

---

## 4. Status lifecycle

```
confirmed → processing → shipped → in_transit → customs → out_for_delivery → delivered
```
Plus three side-branches reachable from **any non-terminal** status: `cancelled`, `refunded`, `returned`.

- **`confirmed` is the starting status** — checkout already captured payment, so there's no separate "awaiting payment" step.
- **Forward-only.** You cannot move backward within the main sequence (e.g. `shipped` → `processing` is rejected with 409). This is enforced server-side, not just a UI convention.
- **Terminal statuses** (`delivered`, `cancelled`, `refunded`, `returned`) cannot be changed again once set — even by an admin.
- **`customs`** is meant for international shipments only — for a domestic order, the seller's UI can just skip straight from `in_transit` to `out_for_delivery`. The server doesn't enforce which statuses are "used" for a given order; it only enforces the forward-only ordering.

### `PATCH /product-orders/shop-orders/:shopOrderId/status`
```json
{ "status": "processing" }
```
**Owner-or-admin only.** There is **no buyer-initiated cancel** — a buyer who wants to cancel must go through the seller/admin, who calls this same endpoint.

**Automatic refund + stock restore:** setting `status` to `cancelled` or `refunded` automatically, in the same call:
1. Credits the buyer's original wallet with whatever was actually paid on this shop-order (checkout amount + any paid charges).
2. Debits that amount back out of the shop's payout wallet.
3. Restores stock and decrements `soldQuantity` for every line item.

No separate refund button/endpoint exists — **the status change IS the refund trigger.** Don't build a UI that calls a refund endpoint and then separately sets status; there is only one call.

**Errors:**

| Status | Code | When |
|---|---|---|
| 403 | `UNAUTHORIZED` | Caller is neither the shop owner nor an admin |
| 409 | `INVALID_STATE` | Backward transition, or order already in a terminal status |
| 422 | — | `status` isn't one of the valid values |

---

## 5. Post-order charges (e.g. real shipping cost, or a catalog add-on)

For when the seller wants to bill for something after the order is already placed — either a one-off fee (shipping cost only known once the package is weighed) or a specific add-on from the product's own catalog (`ProductAddOn`, see the add-ons docs). The seller adds a charge; the buyer pays it separately — two different calls, never automatic.

### `POST /product-orders/shop-orders/:shopOrderId/charges` — add a charge
**Owner-or-admin only.** Two mutually exclusive request shapes:

**Freeform** — type the name/amount directly (e.g. shipping):
```json
{ "name": "International shipping", "description": "Actual courier cost once package was weighed", "amount": 15 }
```

**From a catalog add-on** — send `addOnId` instead, omit `name`/`amount` entirely:
```json
{ "addOnId": 7 }
```
`name` and `amount` are **always pulled from the `ProductAddOn` row itself** in this mode — anything you send in `name`/`amount` alongside `addOnId` is silently ignored, so a charge can never diverge from what the catalog actually says the add-on costs. If you need a custom/discounted price, use the freeform shape instead (no `addOnId`).

**Scoping rule for `addOnId`:** the add-on must belong to a product or variation that is **actually one of this shop-order's own line items** — not just any add-on from the same shop. E.g. if the buyer ordered product #52, only add-ons scoped to product #52 (or one of its variations) are valid; an add-on belonging to a different product from the same shop is rejected with 422, even though it's technically the same seller.

Either way, adding a charge **only increases** the shop-order's `chargesAmount`/`totalAmount` — no money moves yet. The buyer now has a balance due: `totalAmount - paidAmount`. Rejected (409) if the shop-order is already in a terminal status.

**Errors specific to the `addOnId` mode:**

| Status | Code | When |
|---|---|---|
| 404 | `NOT_FOUND` | `addOnId` doesn't exist |
| 422 | `VALIDATION_ERROR` | The add-on exists but doesn't belong to any product/variation in this shop-order |

### `POST /product-orders/charges/:chargeId/pay` — buyer pays it
```json
{ "walletId": 16 }
```
The buyer picks **any** wallet of theirs at the moment of payment — it doesn't have to be the same wallet used at original checkout. Rejects with `CURRENCY_MISMATCH` if that wallet's currency doesn't match the shop's payout wallet, `INSUFFICIENT_BALANCE` if funds are short, or `ALREADY_PAID` (409) if someone already paid this charge.

**UI suggestion:** show unpaid charges (`charges[].isPaid === false`) as a "balance due" banner on the buyer's order-detail page with a "Pay now" button that calls this endpoint.

---

## 6. Quick reference

| Action | Method | Path | Who |
|---|---|---|---|
| Checkout | POST | `/product-orders/checkout` | Buyer |
| My orders (paginated) | GET | `/product-orders` | Buyer |
| One parent order | GET | `/product-orders/:orderId` | Buyer |
| Shop's orders (paginated) | GET | `/product-orders/shop/:shopId` | Owner/admin |
| One shop-order | GET | `/product-orders/shop-orders/:shopOrderId` | Buyer, owner, or admin |
| Update status | PATCH | `/product-orders/shop-orders/:shopOrderId/status` | Owner/admin |
| Add a charge | POST | `/product-orders/shop-orders/:shopOrderId/charges` | Owner/admin |
| Pay a charge | POST | `/product-orders/charges/:chargeId/pay` | Buyer |

## 7. Error response shape

```json
{ "success": false, "error": "message here", "code": "MACHINE_READABLE_CODE" }
```
or, for request-validation failures, a 422 with:
```json
{ "success": false, "errors": [ { "msg": "...", "path": "status", "...": "..." } ] }
```
`code` is a stable machine-readable string (`INSUFFICIENT_BALANCE`, `CURRENCY_MISMATCH`, `INVALID_STATE`, `UNAUTHORIZED`, etc.) — safe to switch on in the client instead of matching the human-readable `error` text.

## 8. What this order system intentionally does NOT do

- **No FX conversion.** If a buyer's wallet and a shop's payout wallet are in different currencies, checkout is rejected rather than converting — same limitation as the existing service-order payment flow.
- **No buyer self-cancel.** Cancellation always goes through the shop owner or an admin via the status-update endpoint.
- **No partial-item cancellation.** A shop-order is cancelled/refunded as a whole, not line-by-line.
- **Charges are always a due balance, never auto-charged.** Adding a charge never pulls money from the buyer automatically — they must explicitly pay it.
