# Backend Updates

Changelog of backend changes for the frontend (Cursor) side to stay in sync. Newest first.

## 2026-11-13 — Two cats (pets, letters by cat, daily mood check-in)

Each person raises one cat: Moon's is white, Sun's is orange. All routes need the usual `x-author` header. (An earlier same-day draft used a single pigeon and `/api/pigeon*`; that was never deployed and is gone.)

### New tables (created automatically by `sql/schema.sql`)
- `cats`: one row per owner (`moon`, `sun`), seeded as `Luna` and `Sol`. Columns: `owner`, `name`, `born_at`, `last_fed_at`, `last_fed_by`, `feed_count`, `xp`, `location`.
  - `location` is whose house the cat is at right now (`moon` or `sun`).
  - `xp` is care points; it decides the growth stage.
- `moods`: one row per author per day, primary key `(author, day)`. `day` is `YYYY-MM-DD` text in `REMINDER_TIMEZONE`. The other columns are `emoji`, `note` and `updated_at`.

### Letters move the cats
`POST /api/letters` now also moves a cat (the request and response are unchanged):
- If the other person's cat is visiting the sender, that cat carries the letter home.
- Otherwise the sender's own cat carries it to the other house, unless it is already there.

### Endpoints
All of these except `GET /pets/moods` return the **pets view** below.
- `GET /api/pets`
- `POST /api/pets/:owner/feed`: feed the cat owned by `:owner`.
  - Only allowed while that cat is at **your** house, so you can feed a visitor but not your own cat while it is away: otherwise **409** `{ error }`.
  - Also **409** while the cat is full (`canFeed: false`), and **404** for an unknown owner.
  - Adds 2 xp. No push is sent.
- `PUT /api/pets/name` `{ name }`: renames your own cat; 1–24 characters, otherwise 400.
- `PUT /api/pets/mood` `{ emoji, note? }`:
  - `emoji` must be one of the 8 in `moods`, and `note` can be up to 140 characters; otherwise 400.
  - Sending again on the same day replaces that day's entry.
  - The first check-in of the day adds 3 xp to your cat.
  - After saving, it pushes to the **other** person: title `"Moon is feeling 🥰 loved today"`, body = the note, url `/pets`.
- `GET /api/pets/moods?days=14` (1–60): both authors' check-ins, newest day first, as `[{ author, day, emoji, note, updated_at }]`.

Pets view:
```json
{ "day": "2026-11-13", "streak": 4,
  "today": { "moon": { "emoji": "🥰", "note": "…", … } | null, "sun": … | null },
  "moods": [{ "emoji": "😄", "label": "Great" }, …],
  "cats": { "moon": { "owner": "moon", "name": "Luna", "born_at": "…", "last_fed_at": "…|null",
      "last_fed_by": "moon|sun|null", "feed_count": 3, "xp": 12, "location": "moon|sun",
      "fullness": 0-100, "hungry": false, "canFeed": true, "asleep": false,
      "stage": { "index": 0-3, "key": "nest|kitten|junior|adult", "label": "2 months old", "next": 30, "progress": 0-100 } },
    "sun": { … } } }
```

How the numbers work:
- **Growth** follows xp: `nest` from 0, `kitten` ("2 months old") from 8, `junior` ("6 months old") from 30, `adult` from 80. `stage.next` is the xp for the next stage (`null` once adult) and `stage.progress` is the percentage toward it.
- **Fullness** drops from 100 to 0 over 24 hours after a feed. Feeding is only allowed below 75, and `hungry` is true below 25.
- **Asleep** is true from 23:00 to 6:00 local.
- **Streak** is the number of days in a row both of you checked in, counted up to today (or up to yesterday while today is still open).

### Daily push
From **18:00 local** until midnight, each person who hasn't checked in that day gets one push from their own cat:
- title `"🐱 Luna is asking"`, url `/pets?checkin=1`, tag `checkin:<day>`.
- If that cat is hungry, the body adds "…and I'm a little hungry."
- It runs inside the existing reminder pass, so the 15-minute scheduler and `POST /api/cron/reminders` (GitHub Actions, every 5 min) both trigger it.
- It is deduped through `reminders_sent` with the key `checkin:<day>:<author>`.

### Env
`CHECKIN_HOUR` is optional and defaults to `18` (local hour, 0–23).

### Frontend
- New tab **Pets** (`/pets`) after Moments: the two houses, each cat's mood bubble, feeding, the check-in form, and the "Put a letter in the pouch" button (opens the compose window).
- `components/CatRoamers.tsx` (mounted in `SiteShell`) shows the cats that are at your house walking along the bottom of every tab. It refetches `GET /pets` on window focus and on the `pets:changed` window event.
- The loading indicator is a flying pigeon carrying a letter (`PigeonLoader`).

### Tests
`node --test src/pets.test.js`

## 2026-11-13 — Optional push when sending a letter

`POST /api/letters` accepts a new optional body field `notify` (boolean, default `true`).
- `notify: false` saves and returns the letter as before but **skips the "New letter from …" push** to the recipient. The letter still shows in their inbox and unread count.
- Omitting it, or any value other than literal `false`, keeps the old behaviour (push sent).
- Nothing is stored; there is no new column.

### Frontend
- The Write tab is gone. Letters are written in `components/ComposeWindow.tsx`, opened from **Mine → New letter** and from **Write back** on the letter page. It has a "Notify" switch that sends `notify`.
- `/` now redirects to `/milestones`, and Moments is the first tab. Old `/?reply_to=<id>` links redirect to `/letter/<id>?reply=1`, which opens the compose window in reply mode.
- New letter templates (ids): `moonlit-night`, `golden-sunrise`, `ruled-notebook`, `sakura`, `autumn-leaves`, `airmail`, `botanical-fern`. The backend stores `template` as free text, so no backend change is needed for them.

### CI
`.github/workflows/keep-awake.yml` now runs every 5 min (was 14).

No new env vars.

## 2026-10-21 — Vietnamese public holidays on the Plans calendar

New `GET /api/holidays?year=YYYY` (requires the author header like other routes). It returns `[{ date: "YYYY-MM-DD", name: "Quốc khánh" }]`, one row per day, with multi-day holidays such as Tết expanded.
- Solar holidays come from Nager.Date (`date.nager.at/api/v3/PublicHolidays/{year}/VN`, free, no key), with Vietnamese names. It lacks Tết and Giỗ Tổ for VN, so the backend derives those from the lunar calendar (`Intl`, Vietnam timezone): 30 Tết and mùng 1–3, plus 10/3 âm. Cached in memory per year until the server restarts.
- Invalid `year` (outside 2000–2100) returns `400`. A Nager failure returns `502 { error }`.
- Note: compensatory days off (nghỉ bù) and Rằm or Trung thu are not included.

### Frontend
`frontend/app/plans/page.tsx` fetches the years in view, tints holiday days in both mini months (name in the tooltip) and shows the holiday name under the day number in the week header. Errors are ignored.

No new env vars.

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
