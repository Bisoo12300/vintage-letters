# Backend Updates

Changelog of backend changes for the frontend (Cursor) side to stay in sync. Newest first.

## 2026-09-19 — Role rename: fox → sun

The second author role is renamed from `fox` to `sun` everywhere:
- `x-author` header now accepts `moon|sun` (was `moon|fox`) — `backend/src/auth.js`'s `AUTHORS` constant. Any request still sending `x-author: fox` now gets `401`.
- Existing Postgres data (`letters.author`, `reading_sessions.reader`, `date_plans.proposed_by`, `push_subscriptions.author`) is migrated in place via idempotent `UPDATE ... WHERE = 'fox'` statements appended to `backend/sql/schema.sql` — this runs automatically on the next deploy via the existing `init()` mechanism (no manual migration step, no data loss).
- Frontend must update its stored/hardcoded `'fox'` identity value to `'sun'` (see `frontend/lib/identity.ts`). A browser with `'fox'` already saved in `localStorage` will simply be treated as "no identity chosen" and re-prompted — not an error.

## 2026-09-19 — PWA push notifications + app badge

### New endpoints (mounted under `/api`)
- `GET /push/vapid-public-key` — public, no auth. Returns `{ publicKey: string | null }`. Call this before subscribing to push.
- `POST /push/subscribe` — requires `x-author: moon|sun`. Body: `{ subscription: { endpoint: string, keys: { p256dh: string, auth: string } } }` (the object returned by `PushSubscription.toJSON()` in the browser). Returns `201 { ok: true }`. Safe to call repeatedly (upserts by endpoint) — supports multiple devices per author.
- `POST /push/unsubscribe` — requires `x-author: moon|sun`. Body: `{ endpoint: string }`. Always returns `{ ok: true }`.

### New required env vars (set in Render dashboard, `sync: false`)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (a `mailto:` contact address)

### New schema
`push_subscriptions` table (auto-applied on next deploy via the existing `init()` mechanism — no manual migration needed): `id, author, endpoint, p256dh, auth, user_agent, created_at`.

### Behavioral changes (no response-shape changes)
These endpoints now additionally fire a best-effort push notification to the *other* author after responding — this never blocks or alters their existing HTTP response/status:
- `POST /letters` — notifies the other author of a new letter.
- `POST /plans` — notifies the other author of a new date proposal.
- `POST /plans/:id/accept` — notifies the plan's proposer that it was accepted.
- `POST /plans/:id/decline` — notifies the plan's proposer that it was declined.

Every push payload includes `unreadCount` (fresh `countUnreadInbox` for the recipient) so the frontend can call `navigator.setAppBadge(unreadCount)` from the service worker — the OS app badge is meant to always mirror the same number as `GET /inbox/unread-count`.

### Frontend integration expected
- Register `/sw.js` (service worker) and call `POST /push/subscribe` after `Notification.requestPermission()` grants permission.
- Sync `navigator.setAppBadge()`/`clearAppBadge()` whenever `GET /inbox/unread-count` is polled (already implemented in `frontend/lib/push.ts` and `frontend/components/SiteShell.tsx`).
