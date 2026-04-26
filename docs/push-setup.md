# Web Push Setup — Operations Guide

This document walks through generating VAPID keys, configuring the env vars, and verifying the full push pipeline. Every Podium environment (local dev, preview, production) needs its own keys.

> **Why VAPID?** The Voluntary Application Server Identification keypair lets push services (FCM, Apple, Mozilla) verify that a notification originated from our servers. The public key is shared with the browser at subscription time; the private key signs each push request server-side.

---

## 1. Generate a keypair

Run from the project root:

```bash
npx web-push generate-vapid-keys
```

This prints two base64url-encoded strings:

```
=======================================
Public Key:
BJ8...about-87-chars
Private Key:
...about-43-chars
=======================================
```

Generate **once per environment**. Don't reuse keys across local + preview + production — each environment is independent and rotating one shouldn't force the others to roll subscriptions.

---

## 2. Set the env vars

Three variables control web push:

| Variable            | Required | Notes                                                     |
| ------------------- | -------- | --------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | yes      | Returned by `/api/push/vapid-key` to subscribing browsers |
| `VAPID_PRIVATE_KEY` | yes      | Server-only; never expose                                 |
| `VAPID_SUBJECT`     | yes      | `mailto:ops@podiumthrows.com` or your contact URL         |

If any of the three are unset, `sendPushToUser()` is a no-op that logs a warning once. This keeps local dev unblocked on machines that haven't been bootstrapped with keys.

### Local

Add to `.env.local`:

```
VAPID_PUBLIC_KEY=BJ8...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

### Vercel preview / production

```bash
vercel env add VAPID_PUBLIC_KEY production
vercel env add VAPID_PRIVATE_KEY production
vercel env add VAPID_SUBJECT production
# Repeat with `preview` for preview deployments.
```

After adding, redeploy — env vars are baked in at build time on Vercel for runtime functions.

---

## 3. Verify the pipeline

### 3a. Server returns the public key

```bash
curl https://YOUR_HOST/api/push/vapid-key
```

Expect `{"publicKey":"BJ8..."}`. A `501 not configured` response means the env vars didn't reach the runtime.

### 3b. End-to-end on a real device

1. Sign in as any test athlete.
2. Visit `/athlete/settings/notifications`.
3. Tap **Enable push notifications** → grant the permission prompt.
4. Tap **Send test notification**.
5. Within 1–3 seconds you should see a notification on the device titled
   _"Test notification"_. Tapping it should focus the tab on `/`.

If step 4 returns `409 No active subscriptions`, the subscribe POST didn't
land — check the network tab for `/api/push/subscribe`.

### 3c. iOS-specific

iOS Safari only supports Web Push when the PWA is **added to the home
screen** AND running on **iOS 16.4 or newer**. The `EnablePushNotifications`
component detects this and surfaces install guidance instead of a broken
Enable button. To verify on iOS:

1. Open Podium in Safari (not Chrome on iOS — that browser uses WebKit too
   but does not expose `pushManager`).
2. Tap the share icon → **Add to Home Screen**.
3. Launch Podium from the home-screen icon (not from Safari).
4. Repeat steps 3a–3b above. The Enable button should now work.

---

## 4. Rotation

If a private key is leaked or rotated:

1. Generate a new pair (`npx web-push generate-vapid-keys`).
2. Replace the env vars on the affected environment.
3. Redeploy.
4. **All existing subscriptions become invalid.** The next push attempt to a
   stale subscription returns 410 Gone, which `sendPushToUser` automatically
   purges from `PushSubscription`. No manual cleanup is required, but users
   will see the next push silently skipped on the old browser until they
   re-subscribe via the settings page.

---

## 5. Common failure modes

| Symptom                                        | Cause / fix                                                                                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/push/vapid-key` returns 501              | Env vars not set or not loaded; redeploy after `vercel env add`                                                                                                              |
| Subscribe succeeds but no notifications arrive | Check `lastUsedAt` in `PushSubscription` — if it stays at `createdAt`, the server isn't actually firing. Look at `getPushPreferences` for the user.                          |
| `web-push` 410 Gone on every send for one user | Browser invalidated the subscription (uninstall, deny, clear data). Row will be auto-purged on next attempt; user can re-subscribe.                                          |
| iOS Enable button does nothing                 | PWA isn't installed to home screen. Component should detect this, but if a user is on iOS 16.3 the same UI applies — push is unavailable.                                    |
| Notifications fire in-app but not on device    | `serviceWorker.ready` resolved a stale registration. Hard-refresh or `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))` from devtools. |

---

## 6. Where the code lives

- `src/lib/push.ts` — `sendPushToUser`, `getVapidPublicKey`. Lazy VAPID config + 410 purge.
- `src/lib/push/preferences.ts` — per-user push preference schema (`PushPreferences`, `getPushPreferences`).
- `src/app/api/push/subscribe/route.ts` — POST upsert / DELETE remove for the calling user's browser.
- `src/app/api/push/vapid-key/route.ts` — GET public key for client subscription.
- `src/app/api/push/test/route.ts` — POST sends a self-test notification (bypasses preference gate).
- `src/app/api/push/send/route.ts` — Internal server-to-server send with preference enforcement.
- `src/components/notifications/EnablePushNotifications.tsx` — subscribe/unsubscribe UI + iOS install gate.
- `src/components/notifications/TestPushButton.tsx` — settings-page test button.
- `public/sw.js` — service worker `push` and `notificationclick` handlers.

For integration call sites (streak reminders, PR celebrations, coach feedback, weekly recap): grep for `sendPushToUser`.
