# Backend Updates

Changelog of backend changes for the frontend (Cursor) side to stay in sync. Newest first.

## 2026-10-02 — Reminder pushes for plans and moments

The backend now sends push reminders to both moon and sun **1 week** and **1 day** before:
- **Plans** that are pending or accepted (declined plans are skipped). Reminders go out 7 days and 24 hours before `starts_at`. Pending plans add "still waiting for a yes".
- **Moments:** a countdown is reminded before its target date; a count-up before each yearly anniversary ("1 year on Mon, Sep 6"). Moments are all-day, so reminders go out at **9:00 local** (`REMINDER_TIMEZONE`, default `Asia/Ho_Chi_Minh`) 7 days and 1 day before.
- A plan created after a stage's time doesn't get that stage. For example, a plan made 3 days ahead gets only the 1-day reminder.
- If the server was asleep, it catches up on the next run. Only the current stage is sent, never both at once.

### Push payload (same shape as existing pushes)
`{ title, body, url, unreadCount, tag }`. Titles are `In a week: <name>` or `Tomorrow: <name>`. `url` is `/plans?date=YYYY-MM-DD` for plans and `/milestones` for moments. `tag` is unique per event and stage; `public/sw.js` now passes it to `showNotification` so a repeat replaces the existing notification instead of stacking.

### How it runs
- In-process scheduler every 15 min (`REMINDER_INTERVAL_MS`). It is **off unless `REMINDERS_ENABLED=1`**, so local dev servers pointed at the real database never push to real phones.
- `POST /api/cron/reminders` with header `x-cron-secret: $CRON_SECRET` runs one pass and returns `{ ok, sent: [keys] }`. Use it from an external cron, because Render's free plan sleeps when idle. It returns 404 when `CRON_SECRET` isn't set and 401 for a wrong secret.
- Dedupe: new table `reminders_sent(key, sent_at)`, created automatically on deploy. Each reminder is claimed with `INSERT … ON CONFLICT DO NOTHING`, so restarts or multiple instances never double-send. A rescheduled event gets fresh reminders, because the key includes the target time.
- Nothing is sent, and nothing is marked sent, when the VAPID keys are missing.

### New env vars
`REMINDERS_ENABLED=1`, `CRON_SECRET` (secret), and optionally `REMINDER_TIMEZONE` and `REMINDER_INTERVAL_MS`.

No frontend changes are needed beyond the `sw.js` tag line, which is already done.

## 2026-10-02 — Paging for My letters and Inbox

`GET /letters` (my letters, with stats) and `GET /inbox` now accept optional `?limit=&offset=`.
- No `limit`: unchanged, the full plain array as before. This is backward compatible.
- With `limit`, the response is an object: `{ items, total, limit, offset }`. `items` is the page (same item shape as before) and `total` is the count of all matching letters. Page count is `ceil(total / limit)`.
- `limit`: 1–100 (values above 100 are capped). `offset`: 0 or more, default 0.
- Order is newest first with `id` as a tiebreak, so pages never overlap or skip.
- Invalid values return `400 { error }`: `limit must be a positive integer` or `offset must be 0 or more`.
- The Inbox header count should keep using `GET /inbox/unread-count`, because a page only holds part of the list.

The frontend uses this for numbered pages (15 per page, `?page=` in the URL) through `frontend/lib/usePagination.ts` and `frontend/components/Pager.tsx`. If an older backend ignores `limit` and returns the whole array, the hook pages it on the client, so it works in either deploy order.

## 2026-10-02 — Milestones (countdown / count-up to important moments)

Shared between both roles (like `/plans`): moon and sun see the same list, and either can edit or delete any milestone. `created_by` records who added it.

### New endpoints (mounted under `/api`, all require `x-author: moon|sun`)
- `GET /milestones` — list, sorted by `at` ascending.
- `GET /milestones/:id` — one milestone, or `404`.
- `POST /milestones` — body `{ title: string, mode?: 'countdown' | 'countup', at: string }`. `mode` defaults to `'countdown'`. `at` is any `Date`-parseable string. Send a full ISO string with an offset (for example `2026-12-24T19:00:00+07:00`) so the local time is preserved. A bare `2025-02-14` is read as UTC midnight. Returns `201` + the milestone.
- `PUT /milestones/:id` — full replace of `{ title, mode, at }` (same validation as POST; send all three). Returns the updated milestone or `404`.
- `DELETE /milestones/:id` — `{ ok: true }` or `404`.

Validation errors return `400 { error }`: `title required`, `mode must be countdown or countup`, `at required`, `Invalid at`.

### Response shape
```ts
type Milestone = {
  id: string;
  title: string;
  mode: 'countdown' | 'countup';
  at: string;          // ISO UTC — target moment (countdown) or start moment (countup)
  created_by: 'moon' | 'sun';
  created_at: string;
  updated_at: string;
};
```

### Meaning of `mode` (the frontend does the ticking)
- `countdown`: show time remaining until `at`, e.g. "còn 83 ngày 4 giờ". After `at` has passed, the FE decides what to show (for example "đã tới!" or switching to elapsed time).
- `countup`: show time elapsed since `at`, e.g. "đã 595 ngày".
- The server returns no computed remaining or elapsed values. Compute them client-side from `at` and `Date.now()` on a timer.

### Schema
New `milestones` table (`id, title, mode, at, created_by, created_at, updated_at`). It is created automatically on the next deploy by the existing `init()`, with no manual migration. The local JSON store gets a `milestones` array.

No push notifications for milestones yet.

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
