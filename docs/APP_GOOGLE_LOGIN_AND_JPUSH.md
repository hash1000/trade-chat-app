# App changes: Google login without Firebase + JPush notifications

For the Flutter app (`TradeChatQRM`, branch `chat_working`, package `com.qrm.naskochina`).
The backend side is already done on branch `chat_working`. This file lists what the app has to change to match it.

Why: Firebase and Google services are blocked in mainland China. Chat already moved from Firestore to the backend's Socket.IO. This finishes the job for **Google login** and **push notifications**.

---

## 1. Google login without Firebase

### What changes
Today the Google button signs in to Google, then signs in to **Firebase Auth** only to read the email, name and photo. The `google_sign_in` account already has those, so the Firebase step goes.
The rest of the flow stays exactly as it is: `/auth/get-user` lookup, then the password sheet for existing users or sign-up for new users.

### `lib/controllers/login_controller.dart` — replace `signInWithGoogle`

```dart
/// Google account picker only — no Firebase. The account's email, name
/// and photo are all the login flow needs. Null when the user cancels.
Future<GoogleSignInAccount?> signInWithGoogle(BuildContext context) async {
  EasyLoading.show();
  try {
    final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) {
      EasyLoading.dismiss();
      return null;
    }
    setIsFromGoogle(true);
    return googleUser;
  } catch (e) {
    EasyLoading.dismiss();
    rethrow;
  }
}
```

### `lib/ui/pages/login/login_page.dart` — the Google button's `onTap` (around line 255)

```dart
await value.signInWithGoogle(context).then((sValue) {
  if (sValue == null) return;            // user closed the picker
  var email = sValue.email;
  EasyLoading.show(statusColor: const Color(0xffbe2528));
  controller.googleLoggedIn(
    context: context,
    email: email,
    displayName: sValue.displayName ?? '',
    photoUrl: sValue.photoUrl ?? '',
  ).then((googleValue) async {
    // ... unchanged ...
```

### Hiding the button in China — already done, keep it
`LoginController.showGoogleSignIn` already hides the button when:
- the phone's region is CN, or
- the clock is on China Standard Time, or
- an Android phone has no Google Play Services.

The button is Android-only (`Platform.isAndroid`). Nothing to change.

### Keep / don't break
- The **Google Cloud project `tradechat-qrm` must stay**. Its OAuth clients (Android + Web) are what `google_sign_in` uses, with or without Firebase.
- For Play Store builds, the **Play App Signing SHA-1** must be registered on the Android OAuth client (Google Cloud Console → APIs & Services → Credentials). Otherwise Google sign-in fails with `ApiException: 10` once `google-services.json` is gone.
- When Firebase is removed, delete the `FirebaseAuth.instance.signOut()` calls (sign-up screens 2/3/4, login page) and keep `GoogleSignIn().signOut()`.

### Optional later: one-step secure Google login
The backend endpoint `POST /api/auth/google-signIn` now **requires a Google ID token**. It verifies the token with Google, then returns the app JWT directly, so no password is needed. The app doesn't use this endpoint today. To use it:

```dart
final googleUser = await GoogleSignIn(
  serverClientId: '894031897163-jvcaa319ide7gt855kq5t70j8b6278h1.apps.googleusercontent.com', // Web client id
).signIn();
final idToken = (await googleUser!.authentication).idToken;
// POST /api/auth/google-signIn  { "idToken": idToken }
// → 200 { message: "User exists. Authentication successful.", token, user }
// → 201 { message: "A new user has been successfully created.", token, user }
// → 401 invalid / expired token
```

---

## 2. Push notifications with JPush

### What the backend does now
- Every push (chat messages, payments, orders, receipts, service requests, friend adds) is sent **from the server**.
- It goes through **JPush** when the user has a JPush registration id. Otherwise it falls back to FCM, until Firebase is removed.
- Text is capped at 150 characters. Extras are capped at about 1.2 KB, which avoids the old "Message is too large" error.

### 2.1 JPush console (one-time, by the account owner)
1. Create the app at jiguang.cn (JPush): Android package `com.qrm.naskochina`, plus the iOS bundle id.
2. Copy the **AppKey** for the app. The **Master Secret** goes only to the backend `.env`, never into the app.
3. iOS: upload the APNs **.p8 auth key** (key id + team id) under iOS settings.
4. Android vendor channels. **These are required for China.** Chinese phones kill background connections, so without vendor channels pushes only arrive while the app is open. Create developer apps for **Huawei, Xiaomi, OPPO, vivo and Honor**, then enter their app id/key/secret in JPush console → Vendor channels.
5. Message categories, so chat isn't throttled as "marketing":
   - Xiaomi: create a "private message" channel and note its `channel_id`.
   - OPPO: create a private-message channel.
   - vivo: use category `IM`.
   - Huawei: apply for the `IM` self-classification.

   Send the resulting ids to the backend team. They go into `JPUSH_THIRD_PARTY_CHANNEL`, for example `{"xiaomi":{"channel_id":"…"},"oppo":{"channel_id":"…"},"vivo":{"category":"IM"},"huawei":{"category":"IM"}}`.

### 2.2 Flutter integration
- `pubspec.yaml`: add `jpush_flutter`, the official JiGuang plugin. Use the latest version from pub.dev and follow its README for the exact API of that version.
- **Android** `android/app/build.gradle` → `defaultConfig`:
  ```gradle
  manifestPlaceholders += [
      JPUSH_PKGNAME: applicationId,
      JPUSH_APPKEY : "<JPush AppKey>",
      JPUSH_CHANNEL: "developer-default",
  ]
  ```
  Then add the JPush **vendor plugins** (Huawei, Xiaomi, OPPO, vivo, Honor) and their placeholders, following JPush's "厂商通道集成 / vendor channel" docs for the same SDK version. Huawei also needs `agconnect-services.json`.
  If OPPO, Xiaomi or vivo use a `channel_id`, create an Android `NotificationChannel` with the **same id** in app code.
- **iOS**: enable the Push Notifications capability, plus Background Modes → Remote notifications.
- Android 13+: request the notification permission. `permission_handler` is already in the project.

### 2.3 Register the device with the backend
After JPush `setup(...)`, get the registration id and send it whenever the user is logged in: after login and on every app start.

```
POST /api/auth/update-fcm            (Authorization: Bearer <app JWT>)
{ "jpushRegistrationId": "<JPush.getRegistrationID()>" }
→ 200 { user }
```

- The id can be empty right after the first launch. Retry when JPush reports it, or after a short delay.
- One device belongs to one account. Registering an id removes it from any other account that used the same phone.
- `POST /api/auth/logout` already clears it on the server. Keep calling logout on sign-out.
- During the transition you may also keep sending `fcmToken`. The backend uses JPush first whenever a JPush id is set.

### 2.4 Handle taps — payload contract
Every push carries **extras**, and **all values are strings**. The keys are the same ones the old FCM `data` had:

| key | always | meaning |
|---|---|---|
| `type` | ✅ | `NEW_MESSAGE`, `SERVICE_REQUEST`, `ADD_REQUEST`, payment/order/receipt types… |
| `entityType` | most | `CHAT`, `RECEIPT`, `ORDER`, … |
| `entityId` | most | id of that entity |
| `chatId` | chat pushes | open this chat |
| `unreadCount` | NEW_MESSAGE | the recipient's unread count for that chat |
| `message` | NEW_MESSAGE, **optional** | JSON string of the formatted message. **Left out when too large.** If it's missing, open the chat by `chatId` and load messages normally |
| `userId` | ADD_REQUEST | who added you |

- Where to read the extras: on **Android**, JPush puts them in `message['extras']['cn.jpush.android.EXTRA']` as a JSON string. On **iOS** they're top-level keys of the message map. Normalise both into one map, then reuse `lib/services/notification_entity_router.dart` for navigation.
- Foreground: skip or silence the notification when the user is already inside that `chatId`. The socket already delivers the message.

### 2.5 Remove the client-side FCM sender — security
`lib/services/push_notification_service.dart` contains a **Firebase admin service-account private key**, hardcoded at about line 1135, and uses it to send FCM pushes **from the phone** (`fcm.googleapis.com/v1/...messages:send`). Anyone who unpacks the APK gets admin access to the Firebase project.

In the JPush version:
- **Delete** the embedded key, `_loadServiceAccountKey`, every client-side `messages:send` call, and the `googleapis_auth` dependency. The backend sends all pushes now.
- Once old app versions are forced to update, the account owner **deletes that key** in Google Cloud Console → IAM → Service accounts → `firebase-adminsdk-pizpg` → Keys (key id starting `f2931d5e`). It can't be deleted earlier, because old app versions still use it to send chat pushes.

---

## 3. Firebase removal checklist (after the final backend Firebase sync)

| Package / file | Action |
|---|---|
| `cloud_firestore` (11 files) | remove — chat is on Socket.IO |
| `firebase_auth` (8 files) | remove — Google login no longer uses it (section 1); delete the `FirebaseAuth.instance.signOut()` calls; the `FirebaseAuthentication.verifyPhoneNumber` class in `login_page.dart` is unused |
| `firebase_messaging` (3 files) | remove — replaced by JPush (section 2) |
| `firebase_storage` (`groupChatController.dart`) | check what it uploads and move it to the backend upload API |
| `firebase_database`, `firebase_app_check`, `firebase_core` | remove |
| `googleapis_auth` | remove (section 2.5) |
| `android/app/google-services.json`, the `com.google.gms.google-services` Gradle plugin, `ios/Runner/GoogleService-Info.plist`, `Firebase.initializeApp()` in `main.dart` | remove |
| Google Cloud project `tradechat-qrm` | **keep** — Google sign-in OAuth clients live there |

Ship this together with a **forced update** (version API), so no old Firebase-based build stays in use.
