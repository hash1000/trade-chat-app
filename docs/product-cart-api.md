# Product Cart API — Frontend Integration Guide

Base path: `{{baseUrl}}/product-cart`
Auth: every endpoint requires `Authorization: Bearer <token>` — this is the **buyer's** cart, one implicit cart per logged-in user. There is no separate "create a cart" step and no cart id — the server resolves the cart from the token.

This is a **separate system** from:
- The old `/addToCart` endpoint (still running, don't use it for new work — no variation or discount support).
- The **service** cart (`/cart`) — that's for booking services, unrelated to products.

A Postman collection with every request + example responses is at `postman/product-apis.postman_collection.json`, folder **"6. Product Cart"** (cart itself) and folder **"8. Product Add-ons"** (seller-facing add-on catalog CRUD — see §5).

---

## 1. Core concept: two kinds of product

Every `ShopProduct` has a `hasVariations` flag that changes what you must send:

| Product type | `hasVariations` | What you send | Where price/stock come from |
|---|---|---|---|
| Simple product | `false` | `shopProductId` only | `ShopProduct.price` / `ShopProduct.quantity` |
| Variation product (e.g. sizes/colors) | `true` | `shopProductId` **and** `variationId` (required) | that variation's `ProductVariation.price` / `.stock` |

**Rule of thumb:** check the product's `hasVariations` before showing an "Add to cart" button. If `true`, the user must pick a variation first (like picking a size before adding a t-shirt) — the API will reject the request with a 422 if `variationId` is missing, and will also reject it if you send a `variationId` for a product that *doesn't* use variations.

---

## 2. Adding to cart

### `POST /product-cart`

**Body (simple product):**
```json
{
  "shopProductId": 101,
  "productCartItemQuantity": 2
}
```

**Body (variation product):**
```json
{
  "shopProductId": 205,
  "variationId": 48,
  "productCartItemQuantity": 3,
  "code": "SAVE10"
}
```

| Field | Required | Notes |
|---|---|---|
| `shopProductId` | yes | integer |
| `variationId` | only if the product has variations | integer. Omit entirely for non-variation products — don't send `null`, just leave the key out |
| `productCartItemQuantity` | no | integer ≥ 1, defaults to `1`. This is **how many units the user is adding to the cart** — not to be confused with `product.quantity` in responses, which is the product's total stock on hand |
| `code` | no | a discount code string, see §6 |
| `addOnIds` | no | array of add-on ids to attach at the same time, see §5. Omit for no add-ons |

**Important — merge behavior:** if the same `(shopProductId, variationId)` is already in the cart, calling this again does **not** create a second line — it adds the new `productCartItemQuantity` onto the existing line's. So "Add to cart" and "Add 1 more" are the same call. Don't try to detect duplicates client-side; just call `POST /product-cart` every time the user clicks "Add to cart".

**Response `201`:**
```json
{
  "success": true,
  "message": "Product added to cart",
  "cartItem": {
    "id": 7,
    "userId": 1,
    "shopProductId": 101,
    "variationId": null,
    "productCartItemQuantity": 2,
    "unitPriceSnapshot": "19.99000000",
    "discountCode": null,
    "discountPercent": "0.00",
    "discountAmount": "0.00000000",
    "addOns": [],
    "createdAt": "2026-07-20T10:00:00.000Z",
    "updatedAt": "2026-07-20T10:00:00.000Z"
  }
}
```
`message` is `"Quantity increased"` instead when it merged into an existing line — same 201 status either way, so you generally don't need to branch on it.

**Add-ons and merging:** if `addOnIds` is included on a merge (the line already existed), it **replaces** the line's add-on selection rather than appending to it. Omit `addOnIds` entirely on a merge call to leave the existing selection untouched.

**Errors to handle:**

| Status | When | Message |
|---|---|---|
| 422 | `variationId` missing on a variation product | `variationId is required for this product` |
| 422 | `variationId` sent on a non-variation product | `This product does not use variations` |
| 404 | product or variation doesn't exist | `Product not found` / `Variation not found for this product` |
| 400 | requested quantity (after merge) exceeds live stock | `Only {N} unit(s) available` |
| 400 | `code` sent but invalid/expired/not for this product | `Discount code is invalid or not applicable to this product` |
| 404 | an `addOnIds` entry doesn't belong to this exact product/variation | `One or more add-ons were not found for this product` |
| 400 | an `addOnIds` entry is inactive or out of stock | `Add-on "{name}" is not currently available` / `Add-on "{name}" is out of stock` |

**Stock note:** this is a *live* check against current stock (`product.quantity` / `variation.stock`) at the moment you call the API — it does not reserve inventory. Two users can both be told "5 available" and both add 5; nothing is decremented until an order is actually placed (order/checkout flow is not built yet). Don't build UI that promises a hold on stock.

---

## 3. Viewing the cart

### `GET /product-cart`

No params — always returns the current user's cart.

**Response `200`:**
```json
{
  "success": true,
  "items": [
    {
      "id": 7,
      "userId": 1,
      "shopProductId": 101,
      "variationId": null,
      "productCartItemQuantity": 2,
      "unitPriceSnapshot": "19.99000000",
      "discountCode": null,
      "discountPercent": "0.00",
      "discountAmount": 0,
      "addOns": [
        { "addOnId": 3, "name": "Camera bag", "price": 30 }
      ],
      "product": {
        "id": 101,
        "name": "Test Plain Product",
        "hasVariations": false,
        "pricing_type": "fixed",
        "price": 19.99,
        "min_price": null,
        "max_price": null,
        "quantity": 5,
        "shopId": 9,
        "productImages": [
          { "id": 11, "url": "https://cdn.example.com/mbp1.jpg", "thumbnailUrl": "https://cdn.example.com/mbp1_thumb.jpg" }
        ]
      },
      "variation": null,
      "subtotal": 39.98,
      "discountAmount": 0,
      "addOnSubtotal": 30,
      "total": 69.98
    },
    {
      "id": 8,
      "userId": 1,
      "shopProductId": 205,
      "variationId": 48,
      "productCartItemQuantity": 25,
      "unitPriceSnapshot": "480000.00000000",
      "discountCode": null,
      "discountPercent": "10.00",
      "discountAmount": "1200000.00",
      "addOns": [],
      "product": {
        "id": 205,
        "name": "Hydraulic Excavator X90",
        "hasVariations": true,
        "pricing_type": "range",
        "price": 0,
        "min_price": 320000,
        "max_price": 480000,
        "quantity": 0,
        "shopId": 9,
        "productImages": []
      },
      "variation": {
        "id": 48,
        "name": "Heavy · 2.5 m³",
        "sizeSpec": "2.5 m³",
        "unit": "per_unit",
        "price": 480000,
        "inStock": true,
        "stock": 90,
        "stockMinOrder": 5,
        "byOrder": true,
        "byOrderMinOrder": 20,
        "images": []
      },
      "subtotal": 12000000,
      "discountAmount": 1200000,
      "addOnSubtotal": 0,
      "total": 10800000
    }
  ],
  "itemCount": 2,
  "cartTotal": 10800069.98
}
```

This is the endpoint to call to render the cart page/drawer — every line already includes the joined `product` (and `variation`, when applicable) plus computed totals, so you don't need extra product-lookup calls.

**Per-line fields you'll actually render:**
- `product.name` and `product.productImages[]` (each `{ id, url, thumbnailUrl }`) — use `thumbnailUrl` for the cart thumbnail if present, falling back to `url`; the array can be empty if the seller hasn't uploaded images
- `variation.name` / `variation.sizeSpec` when `variationId` is not null — show this next to the product name (e.g. "T-Shirt — Large"). When a variation is present, prefer `variation.images[]` (same `{ id, url, thumbnailUrl }` shape) over `product.productImages[]` for the line's thumbnail, since it's the picture of the specific variant the user picked
- `productCartItemQuantity` — how many units are in the cart on this line, editable via §4. **Don't confuse this with `product.quantity` / `variation.stock`** in the nested objects — those are the seller's total stock on hand, not what's in this user's cart
- `unitPriceSnapshot` — the price *at the time it was added*, frozen. It does **not** auto-update if the seller changes the price later. Show this as "price when added" if you want to be transparent, though most UIs just show it as the line price.
- `subtotal` = `unitPriceSnapshot × productCartItemQuantity`
- `discountAmount` — how much was knocked off
- `addOns[]` (each `{ addOnId, name, price, image }`) and `addOnSubtotal` (sum of every selected add-on's `price` — on/off only, no per-add-on quantity) — see §5
- `total` = `subtotal − discountAmount + addOnSubtotal` — this is what to sum for the line item price shown to the user. **Add-ons are never discounted** — the discount only ever applies to the base product/variation price

**Minimum order quantity (variation lines only):** a variation can be sold two independent ways, both toggleable at once — `inStock` (sold from held stock) and `byOrder` (made/sourced on demand) — and **each has its own minimum**:
- `variation.stockMinOrder` — minimum units when `variation.inStock` is `true`
- `variation.byOrderMinOrder` — minimum units when `variation.byOrder` is `true`

If both flags are `true` on a variation, show whichever minimum matches how the user is buying it (or the lower of the two if your UI doesn't distinguish the two purchase modes). In the example above, `productCartItemQuantity: 25` satisfies both (`stockMinOrder: 5` and `byOrderMinOrder: 20`). **Non-variation products have no minimum-order field at all** — `product` never includes one; only `ShopProduct.quantity` (stock) is available, so don't look for a min-order value there.

**Cart-level:** `itemCount` (number of distinct lines, not total units) and `cartTotal` (sum of every line's `total`) — use `cartTotal` for the "Subtotal" shown before checkout.

---

## 4. Changing quantity

### `PATCH /product-cart/:cartItemId/quantity`

```json
{ "productCartItemQuantity": 5 }
```

This **sets** `productCartItemQuantity` to exactly this value — it's not a "+1/-1" delta endpoint. If your UI has +/- steppers, track the current quantity client-side and send the new total each time.

**Special case: `productCartItemQuantity: 0` deletes the line.** Same effect as calling the remove-item endpoint. So a "decrease to zero" stepper naturally removes the item — no special-casing needed on your end.

**Response `200`:**
```json
{ "success": true, "message": "Quantity updated", "cartItem": { "...": "updated line" } }
```
or, if you sent `productCartItemQuantity: 0`:
```json
{ "success": true, "message": "Item removed from cart" }
```

**Errors:**

| Status | When |
|---|---|
| 404 | `cartItemId` doesn't exist or doesn't belong to this user |
| 400 | new quantity exceeds live stock — `Only {N} unit(s) available` |
| 422 | `productCartItemQuantity` is missing, not an integer, or negative |

Note: if the line had a discount code applied and that code has since expired/been deactivated, this call **won't fail** — it silently drops the invalid code and re-applies whatever automatic quantity-tier discount still qualifies (or none). You'll see `discountCode` come back `null` even though you didn't touch the discount. Refresh the discount UI from the response rather than assuming it's unchanged.

---

## 5. Add-ons

Add-ons are optional extras a buyer can attach to a cart line (e.g. "Extra battery — $15", "Carrying case — $25"). Sellers manage the catalog of available add-ons via `postman/product-apis.postman_collection.json` folder **"8. Product Add-ons"** — this section is only about attaching/detaching them on a cart line.

**Scoping — this is the important part:** which add-ons are valid for a line depends on the product type, same rule as everything else in this cart:
- Non-variation product (`hasVariations: false`) → only that **product's own** add-ons are valid.
- Variation product (`hasVariations: true`) → only that **specific variation's own** add-ons are valid — a different variation's add-ons (even on the same product) are rejected.

Fetch the valid choices for a line from `GET /shopProduct/:productId/add-ons` (non-variation) or `GET /shopProduct/:productId/variations/:variationId/add-ons` (variation) — both public, no auth — and show them as a checkbox list before/after adding to cart. Each add-on in that list has its own `id`, `name`, `description`, `price`, `stock`, `isActive`, and an `images[]` gallery (each `{ id, url, thumbnailUrl }`, seller-uploaded via multipart — same S3+thumbnail pipeline as product/variation images, can be empty). Only show add-ons where `isActive: true` and `stock > 0` as selectable.

**Selection is on/off only** — there's no per-add-on quantity. Picking "Camera bag" once adds its price once; it's either on the cart line or it isn't.

**Note on the cart snapshot:** the `addOns[]` stored on a cart line (§3/§4 responses) is `{ addOnId, name, price, image }` — singular `image`, not the whole gallery. It's the URL of the add-on's **first** image at the moment it was attached (or `null` if it had none), frozen just like `name`/`price` — it won't update if the seller changes the add-on's images later. If you need the full gallery on the cart page, look it up from the catalog list you already fetched (by `addOnId`).

### Attach at add-time — include `addOnIds` on `POST /product-cart`
```json
{ "shopProductId": 101, "productCartItemQuantity": 1, "addOnIds": [3, 4] }
```
See §2 above — this is the same endpoint, `addOnIds` is just an optional extra field.

### Attach/replace on an existing line — `POST /product-cart/:cartItemId/add-ons`
```json
{ "addOnIds": [3] }
```
Adds the given add-ons to the line's current selection. If an id is already selected, its snapshot is **replaced** (picks up any price change on the add-on since it was first selected) rather than duplicated.

**Response `200`:**
```json
{
  "success": true,
  "message": "Add-ons updated",
  "cartItem": { "...": "line with addOns[] updated" }
}
```

### Remove from a line — `DELETE /product-cart/:cartItemId/add-ons`
```json
{ "addOnIds": [3] }
```
Removes the given add-on ids from the line's selection. Doesn't touch quantity, discount, or the base price — only `addOns[]` and the derived `addOnSubtotal`/`total`.

**Errors to handle (both endpoints above, and on the `addOnIds` field of `POST /product-cart`):**

| Status | When | Message |
|---|---|---|
| 404 | `cartItemId` doesn't exist / isn't yours | `Cart item not found` |
| 404 | an add-on id doesn't belong to this line's product/variation | `One or more add-ons were not found for this product` |
| 400 | an add-on is currently deactivated by the seller | `Add-on "{name}" is not currently available` |
| 400 | an add-on is out of stock | `Add-on "{name}" is out of stock` |
| 422 | `addOnIds` missing, empty, or not an array of integers | `addOnIds must be a non-empty array` |

**Add-on stock** is checked the same way product/variation stock is — a live `stock > 0` check at the moment you attach it, not reserved. Since selection is on/off (not quantity-based), the check doesn't compare against how many you're requesting, just whether any are left.

**Price is snapshotted**, same as `unitPriceSnapshot` for the product — an add-on's `price` and `name` are frozen into the line's `addOns[]` array the moment it's attached and won't change if the seller edits the add-on later, unless you detach and re-attach it.

---

## 6. Discount codes

There are two kinds of discount in this system (see the product page / discount folders in the Postman collection for the seller-facing CRUD):
- **Manual codes** (e.g. `SAVE10`) — the buyer types one in.
- **Automatic quantity tiers** ("buy 3+, save 5%") — applied automatically based on quantity, no code needed.

**Only one discount applies per line, ever.** A valid code always wins over an automatic tier. You don't need to build any "which discount is better" logic — the backend picks.

**Add-ons are excluded from discounts** — see §5, `discountAmount` is computed on the base product/variation price only.

### Apply a code — `POST /product-cart/:cartItemId/discount`
```json
{ "code": "SAVE10" }
```
**Response `200`:**
```json
{
  "success": true,
  "message": "Discount applied",
  "cartItem": { "...": "line with discountCode/discountPercent/discountAmount updated" }
}
```
**Error `400`** if the code is invalid, expired, over its usage limit, or belongs to a different product: `Discount code is invalid or not applicable to this product`.

### Remove a code — `DELETE /product-cart/:cartItemId/discount`
No body. This does **not** just zero out the discount — it falls back to re-checking automatic quantity tiers for the line's current quantity and applies the best one if it qualifies. So after "removing" a code, the line may still show a non-zero `discountAmount`. Read the response, don't assume 0.

**UI suggestion:** show a "Have a code?" input under each line (or once for the whole cart, applied per-line as the user picks). After apply/remove, replace that line's data with the response's `cartItem` rather than re-fetching the whole cart, for a snappier UI — or just re-call `GET /product-cart` if simplicity matters more than an extra round trip.

---

## 7. Removing items

### One line — `DELETE /product-cart/:cartItemId`
No body. `200` → `{ "success": true, "message": "Item removed" }`. `404` if it doesn't exist / isn't yours.

### Multiple lines at once — `DELETE /product-cart/items`
```json
{ "cartItemIds": [7, 8, 9] }
```
Use this for a "select items → delete selected" bulk action instead of looping individual DELETE calls.

### Clear everything — `DELETE /product-cart`
No body. Wipes every line for the current user — use for a "Clear cart" button. `200` → `{ "success": true, "message": "Cart cleared" }`.

---

## 8. Quick reference

| Action | Method | Path | Body |
|---|---|---|---|
| Add / merge item | POST | `/product-cart` | `{ shopProductId, variationId?, productCartItemQuantity?, code?, addOnIds? }` |
| View cart | GET | `/product-cart` | — |
| Change quantity (0 = remove) | PATCH | `/product-cart/:cartItemId/quantity` | `{ productCartItemQuantity }` |
| Attach/replace add-ons | POST | `/product-cart/:cartItemId/add-ons` | `{ addOnIds: [...] }` |
| Remove add-ons | DELETE | `/product-cart/:cartItemId/add-ons` | `{ addOnIds: [...] }` |
| Apply discount code | POST | `/product-cart/:cartItemId/discount` | `{ code }` |
| Remove discount code | DELETE | `/product-cart/:cartItemId/discount` | — |
| Remove one item | DELETE | `/product-cart/:cartItemId` | — |
| Remove several items | DELETE | `/product-cart/items` | `{ cartItemIds: [...] }` |
| Clear cart | DELETE | `/product-cart` | — |

## 9. Error response shape (all endpoints)

```json
{ "success": false, "error": "message here" }
```
or, for request-validation failures (missing/wrong-typed fields), a 422 with:
```json
{ "success": false, "errors": [ { "msg": "...", "path": "productCartItemQuantity", "...": "..." } ] }
```
Check `success` first; if `false`, show `error` (or the first `errors[].msg`) as a toast/inline message. HTTP status codes used: `400` (business rule, e.g. stock/discount), `404` (not found / not yours), `422` (bad input shape).

## 10. What this cart intentionally does NOT do yet

- **No checkout / order placement.** There's no "place order" endpoint yet — the cart is add/view/edit/remove only. Don't build a checkout button that calls anything under `/product-cart` — that flow doesn't exist yet and will be a separate API when it ships.
- **No stock reservation.** Adding to cart never locks inventory for that user; it's just a live number comparison at write time.
- **Prices aren't live.** `unitPriceSnapshot` is frozen at add-time and won't reflect a seller's later price change until the item is re-added or the quantity is updated (which re-reads the current price).
