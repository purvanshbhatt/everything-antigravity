---
name: push-notifications
disable-model-invocation: true
description: >-
  Implements push notifications with Firebase Cloud Messaging and APNs:
  permission prompt timing, token registration, refresh and cleanup,
  notification vs data payloads, Android channels and iOS provisional
  authorization, web push with VAPID, topics and multicast fan-out,
  preferences, quiet hours and collapse keys. Use when adding push to a
  mobile or web app, debugging missing notifications, or designing
  notification preferences.
---

# Push Notifications

Push is the only channel that reaches users when the app is closed, and the
fastest way to get the app's notifications disabled or uninstalled. Most
"push is broken" reports are stale tokens, a payload type the OS will not
display in the background, a missing Android channel or an iOS permission that
was never granted. Ask for permission at the moment of value, keep tokens
fresh, send only from the server, and respect user preferences.

## When to use

- Adding push to Android, iOS, Flutter, React Native or web apps.
- Notifications arrive on some devices but not others, or only in the foreground.
- Designing notification categories, preferences, quiet hours or rate limits.
- Broadcasting to segments, topics or many devices per user.

## When not to use

- Live in-app updates while the app is open: use `realtime-websockets`.
- Email delivery: use `transactional-email`.
- Marketing campaign strategy and copy: use `growth-marketing`.
- Platform build and signing setup: use `app-store-release` and the platform skills.

## Workflow

1. **Design the notification catalog.** For each type: trigger, audience, category (Android channel, iOS category), urgency, collapse key, deep link, and the preference toggle that controls it. Separate transactional notifications (order shipped) from promotional ones.

   **Check:** Every notification type maps to a user-facing preference and a channel.

2. **Ask for permission at the moment of value.** Explain the benefit in-app first, then trigger the OS prompt when the user does something that needs it (following an order, enabling alerts). Android 13 and later require the `POST_NOTIFICATIONS` runtime permission; iOS supports provisional authorization (`.provisional`) for quiet delivery without a prompt; browsers require a user gesture. Never prompt on first launch.

   **Check:** The OS prompt appears only after an in-app explanation, and declining leaves the app fully usable.

3. **Register and refresh tokens.** After permission, get the FCM registration token and upsert it on the server with user ID, installation or device ID, platform, app version, locale, time zone and `last_seen`. Refresh it on token-refresh callbacks and on every app start; remove it on logout. A user has many devices.

   **Check:** Reinstalling the app or logging out and in leaves exactly one active token per installation.

4. **Send only from the server.** Use the Firebase Admin SDK or the FCM HTTP v1 API (`POST https://fcm.googleapis.com/v1/projects/PROJECT_ID/messages:send` with an OAuth 2.0 access token from a service account). The legacy FCM APIs are shut down; server keys never ship in apps.

   **Check:** No FCM credentials or server keys exist in client code (`grep_search` the app source).

5. **Pick the payload type deliberately.** A `notification` payload is displayed by the OS when the app is in the background. A `data`-only payload is delivered to app code, which must display it; background delivery of data messages is constrained (iOS treats `content-available` pushes as low priority and throttles them). Data values must be strings, and the payload limit is 4 KB. Use platform overrides for channel, priority, sound and collapse behaviour (example below).

   **Check:** Each notification type is tested with the app in foreground, background and killed states on both platforms.

6. **Fan out efficiently.** Per-user sends go to that user's tokens via `sendEachForMulticast` (up to 500 tokens per call). Topics suit public broadcasts, but anyone with the app can subscribe to a topic, so never put private content in topic messages; topic delivery favours throughput over latency. Queue large sends and throttle them.

   **Check:** A 100,000-device campaign completes through the queue without quota errors.

7. **Handle errors and clean up.** Delete tokens that return `UNREGISTERED` (Admin SDK: `messaging/registration-token-not-registered`); investigate `INVALID_ARGUMENT`; retry `UNAVAILABLE`, `INTERNAL` and quota errors with exponential backoff. Prune tokens not seen for a long period (Firebase guidance suggests treating tokens older than about a month as stale; verify against current docs).

   **Check:** The token table shrinks after uninstall tests, and send error rates stay low.

8. **Respect users.** Enforce per-category opt-outs server-side, quiet hours in the user's time zone, frequency caps and collapse keys (`android.collapse_key`, `apns-collapse-id`) so updates replace rather than stack. Keep sensitive details off the lock screen; send "You have a new message" and show content after unlock.

   **Check:** A user in quiet hours receives nothing non-urgent, and opting out of a category stops it immediately.

9. **Test and measure before real sends.** Use test devices, the Firebase console test send, and the iOS simulator (`xcrun simctl push booted com.example.app payload.apns`). Measure delivery and opens (FCM delivery data, analytics events on open). Sending to real users, segments or topics is outward-facing: confirm audience and content with the user first.

   **Check:** Delivery and open metrics are visible per notification type.

## Patterns

### FCM HTTP v1 message with platform overrides

```json
{ "message": {
  "token": "DEVICE_REGISTRATION_TOKEN",
  "notification": { "title": "Order shipped", "body": "Your order arrives Tuesday" },
  "data": { "type": "order_shipped", "orderId": "123", "deepLink": "app://orders/123" },
  "android": { "priority": "high", "collapse_key": "order-123",
               "notification": { "channel_id": "orders" } },
  "apns": { "headers": { "apns-priority": "10", "apns-collapse-id": "order-123" },
            "payload": { "aps": { "sound": "default", "thread-id": "orders" } } },
  "webpush": { "fcm_options": { "link": "https://example.com/orders/123" } } } }
```

### Platform setup essentials

| Platform | Must have |
| :--- | :--- |
| Android | Notification channels (Android 8+), `POST_NOTIFICATIONS` runtime permission (Android 13+), a small monochrome icon |
| iOS | APNs authentication key (.p8) uploaded to Firebase, Push Notifications capability, `requestAuthorization`, a Notification Service Extension for images (`mutable-content: 1`) |
| Web | VAPID key, a service worker (`firebase-messaging-sw.js`), HTTPS; iOS Safari supports web push only for web apps added to the Home Screen |
| Flutter / React Native | `firebase_messaging` or `@react-native-firebase/messaging` (or Expo notifications), with the native setup above |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Prompt for permission on first launch | Explain value, ask at the relevant moment | Users decline, and re-asking is restricted |
| Keep tokens forever | Delete on `UNREGISTERED`, prune stale tokens | Wasted sends and misleading delivery metrics |
| Send from the client or ship server keys | Server-side Admin SDK or HTTP v1 | Anyone can spam your users |
| Data-only payloads for user-visible alerts | Notification payload with platform overrides | Throttled or dropped in the background |
| Private content in topic messages | Per-user token sends | Anyone can subscribe to a topic |
| Same text for every notification | Collapse keys, grouping, frequency caps | Notification spam leads to opt-outs and uninstalls |
| Sensitive text on the lock screen | Generic text, details after unlock | Privacy exposure on shared or visible devices |

## Verification checklist

- [ ] Catalog maps every type to a channel, preference and collapse key.
- [ ] Permission is requested in context; denial is handled gracefully.
- [ ] Tokens are registered, refreshed, removed on logout and pruned on errors.
- [ ] Sends are server-side via HTTP v1 or the Admin SDK, queued and throttled.
- [ ] Foreground, background and killed states are tested on each platform.
- [ ] Preferences, quiet hours and caps are enforced; real-audience sends were confirmed.

## Related

- Knowledge: `flutter-mobile`, `react-native-expo`, `ios-app-development`, `android-jetpack-compose`, `pwa-offline`, `background-jobs`, `realtime-websockets`, `gdpr-privacy`.
- Agents: `mobile-engineer`, `backend-engineer`.
