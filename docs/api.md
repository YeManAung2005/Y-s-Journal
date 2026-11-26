# API Reference

Base path: `/api/v1`

**Implemented:** health, onboarding, authentication, settings, security events, reference data, the financial calculator, completed trades, private screenshots, trading analytics, account adjustments, the Learning tracker (categories, records, goals, milestones/tasks, private attachments, and streaks), the Personal Daily Journal (entries, quick notes, private search, and reminder settings), the Custom Dashboard (widget catalog, layouts, and widget data), the Calendar (monthly aggregation with an optional neutral journal marker), the Poster Studio (template catalog, saved poster configs, and allowlisted poster data), and offline synchronization (shell caching, encrypted local cache, idempotent queued replay, and conflict comparison). Backups are planned for a later phase.

## Conventions

- JSON requests and responses.
- Success envelope: `{ "data": ..., "meta": ... }`.
- Error envelope:

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Human-readable summary.",
    "details": [],
    "requestId": "uuid"
  }
}
```

- Every response includes `x-request-id`.
- Mutating requests require a CSRF token.
- Authenticated routes use a session cookie; authorization is server-side.
- Validation errors use `VALIDATION_ERROR` with field-level details.
- Mutable reference records, trades, learning categories, learning records, learning goals, journal entries, quick notes, and dashboard layouts use `version` / `expectedVersion` optimistic concurrency.
- Offline-safe mutations accept `Idempotency-Key`; duplicates return the stored response instead of applying the change again.

## CSRF flow

1. `GET /api/v1/auth/csrf` returns `{ "data": { "csrfToken": "..." } }` and sets a CSRF cookie.
2. Include that token in the `x-csrf-token` header on every POST/PATCH/PUT/DELETE.
3. Cross-origin POSTs are rejected even with a valid token.
4. Cookie names are `ysj_csrf` in development and `__Host-ysj_csrf` in production.

## Health

### `GET /api/v1/health`

Public. Returns `200` when MongoDB responds, `503` otherwise. No secrets or paths are returned.

```json
{
  "data": {
    "status": "ok",
    "service": "ys-journal-api",
    "version": "0.8.0",
    "environment": "production",
    "mongo": "up",
    "uptimeSeconds": 42,
    "timestamp": "2026-11-24T04:00:00.000Z"
  }
}
```

## Onboarding

### `GET /api/v1/onboarding/status`

Public. `{ "data": { "setupRequired": true } }`.

### `POST /api/v1/onboarding`

Creates the single owner account, default settings, app metadata, a security event, and a session. Rejected with `409 SETUP_COMPLETE` once an owner exists. Rate limited.

```json
{
  "email": "owner@example.com",
  "displayName": "Owner",
  "password": "secure-passphrase-123",
  "confirmPassword": "secure-passphrase-123"
}
```

Password rules: 12–200 characters, at least one letter and one number.

## Authentication

### `POST /api/v1/auth/login`

Rate limited. Progressive delays apply after repeated failures. Returns `401 INVALID_CREDENTIALS` with a generic message.

```json
{ "email": "owner@example.com", "password": "secure-passphrase-123" }
```

### `GET /api/v1/auth/session`

Requires auth. Returns the current user and session timestamps. Without a session: `401 AUTH_REQUIRED`; after inactivity: `401 SESSION_EXPIRED`.

### `POST /api/v1/auth/logout`

Requires auth. Revokes the current session and clears the cookie.

### `POST /api/v1/auth/unlock`

Requires auth. Verifies the password after the 15-minute workspace lock. `401 INVALID_PASSWORD` on failure.

```json
{ "password": "secure-passphrase-123" }
```

### `POST /api/v1/auth/password`

Requires auth. Verifies the current password, hashes the new one, bumps `passwordVersion`, and revokes all other sessions.

```json
{
  "currentPassword": "secure-passphrase-123",
  "newPassword": "new-secure-passphrase-456",
  "confirmNewPassword": "new-secure-passphrase-456"
}
```

## Settings

### `GET /api/v1/settings`

Requires auth. Returns owner preferences with defaults.

### `PATCH /api/v1/settings`

Requires auth and CSRF. Unknown keys are rejected.

```json
{
  "theme": "dark",
  "fontScale": 1,
  "reducedMotion": false,
  "appTimeZone": "Asia/Yangon",
  "tradingTimeZone": "America/New_York",
  "dailyStudyTargetMinutes": 60,
  "calendarJournalIndicator": false
}
```

`calendarJournalIndicator` is a boolean that defaults to `false`. When enabled, calendar days include a neutral `hasJournalEntry` marker for the owner's active journal entries; no journal content is returned.

## Security events

### `GET /api/v1/security/events?limit=50`

Requires auth. Returns the newest events for the owner plus unattributed security events, limited to 100.

Events: `login_success`, `login_failed`, `logout`, `unlock_success`, `unlock_failed`, `password_changed`, `onboarding_completed`, `rate_limited`, `csrf_rejected`, `session_expired`, `access_denied`.

## Reference data

Requires auth. All records are owner-scoped. Create requests return `201`; updates and archive/restore actions return `200`.

### `GET /api/v1/reference?includeArchived=false`

Returns the bootstrap payload:

```json
{
  "data": {
    "instruments": [],
    "accounts": [],
    "tags": [],
    "tradingSessions": [],
    "checklist": []
  }
}
```

On first access the server idempotently creates the four built-in instruments and one default `Main Account` with a `$0.00` starting balance. No tags, sessions, checklist items, or trades are seeded.

### Instruments

- `POST /reference/instruments`
- `PATCH /reference/instruments/:id`
- `POST /reference/instruments/:id/archive`
- `POST /reference/instruments/:id/restore`

```json
{
  "symbol": "NQ",
  "name": "Nasdaq 100 (mini)",
  "pointValueMicros": 20000000,
  "tickValueMicros": 5000000,
  "tickSizeMicros": 250000
}
```

Specifications must satisfy `pointValueMicros × tickSizeMicros = tickValueMicros × 1,000,000`. Built-in instruments may be edited or archived, but duplicate symbols are rejected.

### Accounts

- `POST /reference/accounts`
- `PATCH /reference/accounts/:id`
- `POST /reference/accounts/:id/set-default`
- `POST /reference/accounts/:id/archive`
- `POST /reference/accounts/:id/restore`

```json
{
  "name": "Practice",
  "broker": "Local",
  "accountType": "demo",
  "startingBalance": "1000.00",
  "isDefault": false
}
```

`accountType` is `live` or `demo`. Exactly one active account is default. The default account cannot be archived until another active account is selected.

### Tags

- `POST /reference/tags`
- `PATCH /reference/tags/:id`
- `POST /reference/tags/:id/archive`
- `POST /reference/tags/:id/restore`

```json
{ "type": "setup", "name": "Opening Breakout", "color": "#22c55e" }
```

Types: `setup`, `market_condition`, `custom`.

### Trading sessions

- `POST /reference/trading-sessions`
- `PATCH /reference/trading-sessions/:id`
- `POST /reference/trading-sessions/:id/archive`
- `POST /reference/trading-sessions/:id/restore`

```json
{ "name": "New York", "color": "#3b82f6", "displayOrder": 1 }
```

### Checklist

- `POST /reference/checklist`
- `PATCH /reference/checklist/:id`
- `POST /reference/checklist/:id/archive`
- `POST /reference/checklist/:id/restore`

```json
{ "text": "Confirm initial risk before entry", "sortOrder": 0 }
```

All PATCH bodies must include `expectedVersion`, the version currently displayed by the client. A stale version returns `409 VERSION_CONFLICT`.

## Financial calculator

### `POST /api/v1/finance/calculate`

Requires auth and CSRF. Recomputes a trade preview on the server and stores nothing.

```json
{
  "direction": "long",
  "instrument": {
    "pointValueMicros": 20000000,
    "tickValueMicros": 5000000,
    "tickSizeMicros": 250000
  },
  "entryPrice": "25000.00",
  "quantity": "3.00",
  "exits": [
    { "price": "25020.00", "quantity": "1.00" },
    { "price": "25040.00", "quantity": "1.00" },
    { "price": "25050.00", "quantity": "1.00" }
  ],
  "fees": "15.00",
  "initialStopPrice": "24990.00",
  "manualRisk": null
}
```

The response includes `grossPnlMicros`, `netPnlMicros`, `outcomeGross`, `outcomeNet`, `grossR`, `feeAllocationsMicros`, `automaticRiskMicros`, `manualRiskMicros`, `selectedRiskMicros`, `weightedAverageExitTicks`, `weightedAverageExitPrice`, and per-exit calculations. `netPnlMicros`, `outcomeNet`, and `grossR` are `null` when their inputs are unavailable.

## Trading journal

Requires auth. Every query is owner-scoped. Trade mutations require CSRF. Monetary values are integer micro-USD; `null` means unavailable, never zero.

### `GET /api/v1/trades`

Optional query parameters: `includeDeleted`, `accountId`, `instrumentId`, `outcome`, `from`, `to`, and `limit` (1–200, default 100). Returns `{ "data": { "trades": [...] } }` with each trade's screenshot metadata.

### `POST /api/v1/trades`

Creates one completed trade and returns `201`.

```json
{
  "accountId": "665f1c2a9b8d4e3f2a1b0c9d",
  "instrumentId": "665f1c2a9b8d4e3f2a1b0c9e",
  "tradeDate": "2026-11-24",
  "direction": "long",
  "entryPrice": "25000.00",
  "quantity": "3.00",
  "exits": [
    { "price": "25020.00", "quantity": "1.00" },
    { "price": "25040.00", "quantity": "2.00" }
  ],
  "fees": "15.00",
  "initialStopPrice": "24990.00",
  "manualRisk": null,
  "sessionId": null,
  "tagIds": [],
  "checklist": [],
  "emotions": ["focused"],
  "ruleViolations": [],
  "notes": "",
  "lessons": "",
  "review": {
    "followedPlan": "yes",
    "whatWentWell": "Waited for confirmation",
    "whatToImprove": "",
    "confidence": 4,
    "reviewedAt": "2026-11-24"
  }
}
```

- One to 50 partial exits are allowed; exit quantities must sum exactly to `quantity`.
- Prices must align to the instrument tick size. The server uses its stored instrument specification; client-supplied specs are ignored.
- `fees: null` leaves `netPnlMicros`, net outcome, and per-exit net values `null`.
- Risk comes from `manualRisk` when supplied, otherwise from a valid `initialStopPrice`. Missing risk leaves `grossR` `null`.
- Account, instrument, session, tag, and checklist snapshots are stored with the trade.

### `GET /api/v1/trades/:id`

Returns one active trade with screenshots and calculated fields. Soft-deleted trades are omitted; use `GET /trades?includeDeleted=true` and the returned ID for trash views.

### `PATCH /api/v1/trades/:id`

Requires `expectedVersion`. Any stored trade field may be updated; the server recomputes all financial values and increments `version`. A stale version returns `409 VERSION_CONFLICT`.

### `DELETE /api/v1/trades/:id`

Body: `{ "expectedVersion": 0 }`. Soft-deletes the trade and marks its active screenshots with `deletedReason: "trade_deleted"`.

### `POST /api/v1/trades/:id/restore`

Body: `{ "expectedVersion": 1 }`. Restores the trade and screenshots previously marked `trade_deleted`. Manually deleted files stay deleted.

### `POST /api/v1/trades/:id/screenshots`

`multipart/form-data` with repeated `screenshots` fields. Up to five active screenshots per trade, each 10 MB or smaller. JPEG, PNG, and WebP are decoded from their contents, validated against the declared MIME type, re-encoded without metadata, and stored under generated keys in `storage/uploads`. Returns `{ "data": { "files": [...] } }` with private file URLs.

### `GET /api/v1/files/:id`

Returns image bytes only to the authenticated owner. Responses use `no-store`, `nosniff`, and a safe inline filename. Unknown or foreign IDs return `404 NOT_FOUND` and record `access_denied`. No filesystem path or storage key is accepted from a client.

### `DELETE /api/v1/files/:id`

Requires auth and CSRF. Soft-deletes the file record; later reads return `404`.

## Trading analytics

All analytics routes require authentication and read only the authenticated owner's active trades. Personal Journal data is never imported or queried by these services.

Shared query parameters:

| Parameter      | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `from` / `to`  | Inclusive `YYYY-MM-DD` trade-date range                                |
| `accountId`    | Filter by trading account                                              |
| `instrumentId` | Filter by instrument                                                   |
| `sessionId`    | Filter by trading session                                              |
| `tagId`        | Filter by tag; a trade with several tags matches each matching tag     |
| `direction`    | `long` or `short`                                                      |
| `outcome`      | `win`, `loss`, or `break_even` on the selected basis                   |
| `basis`        | `gross` or `net`; default `net`. Net outcome filters omit missing fees |

Net aggregates are `null` when any selected trade has `feesMicros: null`. Average R uses only trades with stored `grossR`, and `coverage` reports how many trades were included. Profit factor is `"Infinity"`, `"0"`, or `null` per the financial specification.

### `GET /api/v1/analytics/summary`

Returns `summary` with trade count, gross/net P&L, selected-basis P&L, win rate, average win/loss, profit factor, average R, daily win/loss counts, maximum drawdown, streaks, and `coverage`.

### `GET /api/v1/analytics/equity`

Returns `equity.points` with one point per filtered trade, plus one point per account adjustment when an account is selected. Each point includes `id`, `kind`, `date`, `cumulativeNetPnlMicros`, `accountBalanceMicros`, `tradeCount`, `adjustmentCount`, and completeness flags. Trades also include symbol, direction, and their net P&L; adjustments include their type and signed amount. Cumulative net P&L starts at `$0` for the selected filters, so every trade moves the curve up or down even when several trades share a date. Account balance requires a single `accountId` and uses that account's starting balance, all completed net trade P&L, and all deposits, withdrawals, and corrections up to each date. Once a missing-fee trade is encountered, the affected cumulative value is `null` from that point onward.

### `GET /api/v1/analytics/breakdowns?dimension=...`

`dimension` is `instrument`, `session`, `direction`, `tag`, `account`, or `dayOfWeek`. Each group returns the same summary shape. A trade with several tags appears once in each matching tag group; untagged trades appear under `Untagged`.

### `GET /api/v1/analytics/compare`

Requires `from`, `to`, `compareFrom`, and `compareTo`. Returns `current`, `baseline`, and `deltas` for trade count, selected-basis P&L, win rate, and average R. All other filters are applied to both periods.

## Learning

All Learning routes require authentication and are scoped to the owner. Mutations require CSRF and `expectedVersion` where the record is mutable. Learning services never query Personal Journal data.

### `GET /api/v1/learning/categories`

Optional `includeArchived=true` return archived categories as well. Returns `{ "data": { "categories": [...] } }`, sorted by name.

### `POST /api/v1/learning/categories`

Requires auth and CSRF. Body:

```json
{ "name": "Market structure", "color": "#8b5cf6" }
```

`name` is 1–80 characters; `color` must be a six-digit hex color and defaults to `#8b5cf6`. The slug is generated server-side from the name and must be unique per owner.

### `PATCH /api/v1/learning/categories/:id`

Requires auth, CSRF, and `expectedVersion`. Body may include `name` and/or `color`. A stale version returns `409 VERSION_CONFLICT`. Renaming regenerates the slug but does not rewrite existing record or goal snapshots.

### `POST /api/v1/learning/categories/:id/archive` and `/restore`

Require auth and CSRF. Archive sets `archivedAt`; restore clears it. Archived categories cannot be selected for new records or goals, but existing snapshots and records remain readable.

### `GET /api/v1/learning/records`

Optional query parameters: `includeDeleted`, `from`, `to`, `categoryId`, `goalId`, and `limit` (1–200, default 100). Returns `{ "data": { "records": [...] } }` with each record's category snapshot, resource links, and active attachment metadata, newest date first.

### `POST /api/v1/learning/records`

Requires auth and CSRF. Body:

```json
{
  "date": "2026-11-25",
  "categoryId": "665f1c2a9b8d4e3f2a1b0c9d",
  "goalId": null,
  "topic": "Liquidity sweeps",
  "keyTakeaways": "Wait for the reclaim before entering.",
  "durationMinutes": 45,
  "notes": "Reviewed three examples.",
  "resources": [{ "label": "Notes", "url": "https://example.com/notes" }]
}
```

`date` is `YYYY-MM-DD` in the app time zone. `durationMinutes` is an integer 0–1440. Resource URLs must be HTTP(S); up to 20 links are accepted. `goalId` must reference an active owner-scoped goal or be `null`. The category snapshot is captured at creation.

### `GET /api/v1/learning/records/:id`

Returns one active record with its attachments. Soft-deleted records are omitted; use the list with `includeDeleted=true` to find them.

### `PATCH /api/v1/learning/records/:id`

Requires auth, CSRF, and `expectedVersion`. Any record field may be updated. Changing the category captures a fresh category snapshot; changing to another category does not rewrite older records. A stale version returns `409 VERSION_CONFLICT`.

### `DELETE /api/v1/learning/records/:id`

Body: `{ "expectedVersion": 0 }`. Soft-deletes the record and marks its active attachments with `deletedReason: "learning_record_deleted"`.

### `POST /api/v1/learning/records/:id/restore`

Body: `{ "expectedVersion": 1 }`. Restores the record and attachments deleted by that record deletion. Manually deleted files stay deleted.

### `POST /api/v1/learning/records/:id/attachments`

`multipart/form-data` with repeated `attachments` fields. Up to five active attachments per record, each 10 MB or smaller. Only JPEG, PNG, and WebP content is accepted; bytes are decoded from file contents, re-encoded without metadata, and stored under generated keys in `storage/uploads`. Returns `{ "data": { "attachments": [...] } }` with private file URLs. Use `GET` and `DELETE /api/v1/files/:id` to view or remove an individual attachment.

### `GET /api/v1/learning/goals`

Optional query parameters: `includeDeleted`, `categoryId`, `status` (`active` or `completed`), and `limit` (1–200, default 100). Returns `{ "data": { "goals": [...] } }` with embedded milestones, tasks, and server-calculated progress.

### `POST /api/v1/learning/goals`

Requires auth and CSRF. Body:

```json
{
  "title": "Build a repeatable study routine",
  "description": "Finish the course and review notes weekly.",
  "categoryId": "665f1c2a9b8d4e3f2a1b0c9d",
  "targetDate": "2026-12-31",
  "status": "active"
}
```

`categoryId` and `targetDate` may be `null`. A new goal starts at `progressPercent: 0` with no milestones or tasks.

### `GET /api/v1/learning/goals/:id`

Returns one active goal with its milestones, tasks, completion counts, and `progressPercent`.

### `PATCH /api/v1/learning/goals/:id`

Requires auth, CSRF, and `expectedVersion`. Title, description, category link, target date, and status may be updated. Setting status to `completed` sets `completedAt`; setting it back to `active` clears it.

### `DELETE /api/v1/learning/goals/:id` and `POST /api/v1/learning/goals/:id/restore`

Require auth, CSRF, and `expectedVersion`. Soft-delete and restore the goal. Linked records keep their `goalId`; the client should treat a deleted goal as unavailable for new links.

### `POST /api/v1/learning/goals/:id/milestones`

Requires auth, CSRF, and `expectedVersion`. Body:

```json
{
  "title": "Finish module one",
  "dueDate": "2026-12-01",
  "expectedVersion": 0
}
```

`dueDate` may be `null`. The response returns the updated goal with the new milestone and an incremented `version`.

### `PATCH /api/v1/learning/goals/:id/milestones/:milestoneId`

Requires auth, CSRF, and `expectedVersion`. Body may include `title`, `dueDate`, and/or `completed`. Completion timestamps are set by the server and cannot be supplied by the client.

### `DELETE /api/v1/learning/goals/:id/milestones/:milestoneId`

Requires auth, CSRF, and `expectedVersion`. Removes the milestone and recalculates progress.

### `POST /api/v1/learning/goals/:id/tasks`

Requires auth, CSRF, and `expectedVersion`. Body: `{ "title": "Write a summary", "expectedVersion": 1 }`. Returns the updated goal with the new task.

### `PATCH /api/v1/learning/goals/:id/tasks/:taskId`

Requires auth, CSRF, and `expectedVersion`. Body may include `title` and/or `completed`. Completion is timestamped server-side.

### `DELETE /api/v1/learning/goals/:id/tasks/:taskId`

Requires auth, CSRF, and `expectedVersion`. Removes the task and recalculates progress.

Progress is `round(100 × completed items / total items)` across milestones and tasks, and is `0` when a goal has no items.

### `GET /api/v1/learning/summary`

Optional `from` and `to` date filters. Returns:

```json
{
  "data": {
    "summary": {
      "today": "2026-11-25",
      "dailyTargetMinutes": 60,
      "currentStreak": 2,
      "longestStreak": 5,
      "totalMinutes": 210,
      "recordCount": 5,
      "activeDays": 4,
      "qualifyingDays": 3,
      "lastStudyDate": "2026-11-25",
      "todayMinutes": 60,
      "todayRecordCount": 2,
      "targetMetToday": true,
      "days": []
    }
  }
}
```

`today` and study dates use the owner's configured app time zone. A day qualifies for a streak when its total minutes reach `dailyStudyTargetMinutes`; a zero target means any positive study time qualifies. The current streak starts from today when today qualifies, otherwise from yesterday. The longest streak is all-time. `from`/`to` filter `totalMinutes`, `recordCount`, `activeDays`, and `days`; streaks and `qualifyingDays` always use full history.

## Personal Daily Journal

All Daily Journal routes require authentication and are scoped to the owner. Mutations require CSRF and `expectedVersion` where the record is mutable. Journal services import only journal models; no analytics, dashboard, poster, trading, or learning service reads journal data.

### `GET /api/v1/journal/entries`

Optional query parameters: `includeDeleted`, `date`, `from`, `to`, `q`, and `limit` (1–200, default 100). Returns `{ "data": { "entries": [...] } }`, newest date first. Deleted entries are omitted unless `includeDeleted=true`.

### `POST /api/v1/journal/entries`

Requires auth and CSRF. Body:

```json
{
  "date": "2026-11-25",
  "highlights": "Finished the project",
  "challenges": "A long meeting",
  "lessons": "Protect focus time",
  "gratitude": ["Good health", "A helpful friend"],
  "mood": 4,
  "reflection": "A steady day.",
  "freeWriting": "Anything private goes here.",
  "tomorrowPriorities": ["Write the report"]
}
```

Omitted text fields default to empty strings/lists and `mood` defaults to `null`. `date` is `YYYY-MM-DD` in the app time zone. `mood` is `1`–`5` or `null`; gratitude accepts up to three strings and priorities up to five. Only one active entry per owner per date is allowed; a duplicate returns `409 CONFLICT`.

### `GET /api/v1/journal/entries/:id`

Returns one active entry. Foreign or soft-deleted IDs return `404 NOT_FOUND`.

### `PATCH /api/v1/journal/entries/:id`

Requires auth, CSRF, and `expectedVersion`. Any entry field may be changed, including the date (subject to the one-per-date rule). A stale version returns `409 VERSION_CONFLICT`.

### `DELETE /api/v1/journal/entries/:id` and `POST /api/v1/journal/entries/:id/restore`

Require auth, CSRF, and `expectedVersion`. Delete soft-deletes the entry; restore clears `deletedAt` and restores it only if no other active entry uses that date.

### `GET /api/v1/journal/notes`

Optional query parameters: `includeDeleted`, `date`, `from`, `to`, `q`, and `limit` (1–200, default 100). Returns `{ "data": { "notes": [...] } }`, newest date and creation time first.

### `POST /api/v1/journal/notes`

Requires auth and CSRF. Body: `{ "date": "2026-11-25", "text": "A thought to keep" }`. Text is required after trimming and at most 5,000 characters.

### `PATCH /api/v1/journal/notes/:id`

Requires auth, CSRF, and `expectedVersion`. Body may include `date` and/or `text`. A stale version returns `409 VERSION_CONFLICT`.

### `DELETE /api/v1/journal/notes/:id` and `POST /api/v1/journal/notes/:id/restore`

Require auth, CSRF, and `expectedVersion`. Delete and restore are owner-scoped soft operations.

### `GET /api/v1/journal/search`

Optional query parameters: `q` (required, 1–200 characters), `scope` (`all`, `entries`, or `notes`), `from`, `to`, and `limit` (1–100, default 50). Returns:

```json
{
  "data": {
    "entries": [],
    "notes": []
  }
}
```

Search is case-insensitive and literal; it queries only the authenticated owner's active journal entries and quick notes. Soft-deleted records are excluded. Journal search never reads trading, learning, or dashboard data.

## Dashboard

All Dashboard routes require authentication and are scoped to the owner. Mutations require CSRF. Widget data is assembled only from trading analytics, learning summaries/goals, and calendar aggregation; Personal Journal content is never included.

### `GET /api/v1/dashboard/widgets`

Returns `{ "data": { "widgets": [...] } }` with the widget catalog. Each entry includes `id`, `title`, `description`, `defaultSize`, and `defaultSettings`:

- `trades_summary` — Trade count, selected-basis P&L, win rate, and average R. Default size `medium`; default settings `basis: "gross"`, `days: 30`.
- `study_summary` — Today's minutes, current streak, and longest streak. Default size `small`; default settings `days: 30`.
- `calendar_activity` — Full-width, GitHub-style activity calendar for the last 12 months, with a day-by-day trading/study heatmap. Default size `large` and always rendered full width; no default settings.
- `goals_progress` — Active learning goals with server-calculated progress. Default size `medium`; no default settings.

### `GET /api/v1/dashboard/layouts`

Returns `{ "data": { "layouts": [...] } }`. A default layout named `Default dashboard` is created on first access when none exists. Each layout includes `id`, `name`, `isDefault`, `widgets` sorted by `position`, `version`, and `updatedAt`.

### `POST /api/v1/dashboard/layouts`

Requires auth and CSRF. Returns `201` with `{ "data": { "layout": ... } }`.

```json
{
  "name": "Focus",
  "isDefault": false,
  "widgets": [
    {
      "id": "trades_summary",
      "visible": true,
      "size": "large",
      "position": 0,
      "settings": { "basis": "net", "days": 7 }
    }
  ]
}
```

`isDefault` defaults to `false`. Names are 1–60 characters and unique per owner. Up to 20 widgets are accepted; each `id` must be a catalog ID, `visible` defaults to `true`, `size` is `small`, `medium`, or `large` (default `medium`), `position` is an integer 0–50, `settings.basis` is `gross` or `net`, and `settings.days` is an integer 7–365.

### `PATCH /api/v1/dashboard/layouts/:id`

Requires auth, CSRF, `expectedVersion`, and at least one of `name`, `isDefault`, or `widgets`. Returns the updated layout. A stale version returns `409 VERSION_CONFLICT`; a duplicate name returns `409 CONFLICT`. Setting `isDefault` to `true` is equivalent to the default-layout route below.

### `DELETE /api/v1/dashboard/layouts/:id`

Requires auth, CSRF, and a body of `{ "expectedVersion": 0 }`. The current default layout cannot be deleted and returns `409 DEFAULT_LAYOUT`. A stale version returns `409 VERSION_CONFLICT`.

### `POST /api/v1/dashboard/layouts/:id/default`

Requires auth, CSRF, and a body of `{ "expectedVersion": 0 }`. Makes the layout the owner's single default and increments its `version`. A stale version returns `409 VERSION_CONFLICT`.

### `GET /api/v1/dashboard/data?layoutId=...`

Requires auth. `layoutId` is an optional owner-scoped layout ObjectId; without it the default layout is used. Returns `{ "data": { "layout": ..., "widgets": [...] } }`, where each visible widget includes `id`, `title`, `size`, and its resolved `data`. Foreign or unknown layout IDs return `404 NOT_FOUND`. Net P&L in `trades_summary` follows the strict missing-fee rules of the analytics service. `calendar_activity` always reports size `large` and includes `from`, `to`, a 365-day `summary`, and a `days` array with `date`, `tradeCount`, `studyMinutes`, and `studyRecordCount` for the full-width year heatmap.

## Calendar

Calendar routes require authentication. Calendar responses are derived on request from owner-scoped active trades and learning records; no calendar documents are stored.

### `GET /api/v1/calendar/month?month=YYYY-MM`

`month` is required in `YYYY-MM` format; other formats return `400 VALIDATION_ERROR`. Returns one entry per day of the month plus month bounds, a summary, and the journal-marker state:

```json
{
  "data": {
    "month": "2026-11",
    "from": "2026-11-01",
    "to": "2026-11-30",
    "journalIndicatorEnabled": false,
    "summary": {
      "activeDays": 0,
      "tradeDays": 0,
      "studyDays": 0,
      "tradeCount": 0,
      "studyMinutes": 0,
      "studyRecordCount": 0
    },
    "days": [
      {
        "date": "2026-11-01",
        "tradeCount": 0,
        "grossPnlMicros": 0,
        "netPnlMicros": null,
        "studyMinutes": 0,
        "studyRecordCount": 0
      }
    ]
  }
}
```

Each day includes `date`, `tradeCount`, `grossPnlMicros`, `netPnlMicros`, `studyMinutes`, and `studyRecordCount`. `netPnlMicros` is `null` on empty days and whenever any trade that day has missing fees. When the owner setting `calendarJournalIndicator` is `true`, `journalIndicatorEnabled` is `true` and each day also includes a boolean `hasJournalEntry` derived only from the owner's active journal entry dates. No journal text, mood, gratitude, notes, priorities, or attachments are returned, and another owner's entries are never marked.

## Poster Studio

All Poster routes require authentication and are scoped to the owner. Mutations require CSRF. Poster data is assembled only from trading analytics, learning summaries, or one explicitly selected completed trade; Personal Journal models and content fields are never imported. PNG generation happens locally in the browser, so no export upload endpoint exists.

### `GET /api/v1/posters/catalog`

Returns `{ "data": { "types": [...], "templates": [...], "dimensions": [...], "defaults": {...} } }`.

- Types are `trading`, `learning`, and `trade`.
- Templates are `midnight`, `paper`, and `ember`, each with a display palette.
- Dimensions are `square` (1080×1080), `portrait` (1080×1350), and `story` (1080×1920).
- Defaults are `type: "trading"`, `template: "midnight"`, `dimension: "square"`, `accentColor: "#8b5cf6"`, `logoPosition: "top-left"`, `days: 30`, and `basis: "gross"`.

### `GET /api/v1/posters/configs`

Returns `{ "data": { "configs": [...] } }` for the owner, newest updated first. Each config includes `id`, `name`, `type`, `template`, `dimension`, `accentColor`, `headline`, `subtitle`, `footer`, `logoPosition`, `days`, `basis`, `tradeId`, `version`, `createdAt`, and `updatedAt`.

### `POST /api/v1/posters/configs`

Requires auth and CSRF. Returns `201` with `{ "data": { "config": ... } }`.

```json
{
  "name": "Focus poster",
  "type": "trading",
  "template": "paper",
  "dimension": "portrait",
  "accentColor": "#22c55e",
  "headline": "Discipline pays",
  "subtitle": "A focused month",
  "footer": "Private review",
  "logoPosition": "top-right",
  "days": 14,
  "basis": "net"
}
```

Names are 1–80 characters and unique per owner. `type` is required. For `type: "trade"`, `tradeId` must reference one of the owner's active completed trades. Text overrides are optional and limited to 80 characters for the headline, 140 for the subtitle, and 100 for the footer. `logoPosition` is `top-left`, `top-right`, `bottom-left`, `bottom-right`, or `none`. `accentColor` must be a `#RRGGBB` hex color. `days` is an integer from 7 to 365, and `basis` is `gross` or `net`.

### `PATCH /api/v1/posters/configs/:id`

Requires auth, CSRF, `expectedVersion`, and at least one poster field. Returns the updated config and increments `version`. A stale version returns `409 VERSION_CONFLICT`; a duplicate name returns `409 CONFLICT`.

### `DELETE /api/v1/posters/configs/:id`

Requires auth, CSRF, and a body of `{ "expectedVersion": 0 }`. Returns the deleted config. A stale version returns `409 VERSION_CONFLICT`.

### `GET /api/v1/posters/data`

Requires auth. `type` is `trading`, `learning`, or `trade`. `days` defaults to 30 and must be 7–365. `basis` defaults to `gross` and applies to trading and trade data. `tradeId` is required only when `type=trade` and must reference one of the owner's active completed trades; otherwise the request returns `404`.

```json
{
  "data": {
    "type": "trading",
    "from": "2026-10-28",
    "to": "2026-11-26",
    "days": 30,
    "basis": "gross",
    "title": "Trading performance",
    "metrics": [
      { "id": "trades", "label": "Trades", "kind": "integer", "value": 24 },
      { "id": "pnl", "label": "Gross P&L", "kind": "money", "value": 1240500000 },
      { "id": "winRate", "label": "Win rate", "kind": "percent", "value": "0.54" },
      { "id": "averageR", "label": "Average R", "kind": "multiple", "value": "1.8" }
    ],
    "note": null
  }
}
```

A trade poster uses `GET /api/v1/posters/data?type=trade&tradeId=<id>&basis=net`:

```json
{
  "data": {
    "type": "trade",
    "from": "2026-11-26",
    "to": "2026-11-26",
    "days": 1,
    "basis": "net",
    "title": "NQ Long",
    "subtitle": "Nov 26, 2026 · Entry 25000 → Exit 25010 · 1 qty",
    "metrics": [
      { "id": "roi", "label": "ROI on risk", "kind": "percent", "value": "0.975" },
      { "id": "pnl", "label": "Net P&L", "kind": "money", "value": 195000000 },
      { "id": "r", "label": "R multiple", "kind": "multiple", "value": "0.975" },
      { "id": "risk", "label": "Risked", "kind": "money", "value": 200000000 }
    ],
    "note": null,
    "trade": {
      "id": "64b7f9c2a1d3e4f5a6b7c8d9",
      "symbol": "NQ",
      "direction": "long",
      "tradeDate": "2026-11-26",
      "entryPrice": "25000",
      "exitPrice": "25010",
      "quantity": "1",
      "accountName": "Main"
    }
  }
}
```

Trading metrics are trades, selected-basis P&L, win rate, and average R. Learning metrics are study minutes, active days, current streak, and longest streak, using the owner's daily study target for streaks. A trade poster returns ROI on risk, selected-basis P&L, R multiple, and selected risk for one completed trade. ROI is `selectedPnl / selectedRisk`; net P&L stays `null` when fees are missing, and ROI stays `null` when risk is missing or non-positive. An explanatory `note` is included when a value is unavailable. Journal content is never returned, and trade posters expose no trade notes, lessons, review, emotions, rule violations, or screenshots.

## Account adjustments

### `GET /api/v1/accounts/:accountId/adjustments`

Returns active owner-scoped adjustments for the account, newest first.

### `POST /api/v1/accounts/:accountId/adjustments`

Requires auth and CSRF. Body:

```json
{
  "type": "deposit",
  "amount": "500.00",
  "date": "2026-11-24",
  "note": "Transfer in"
}
```

`type` is `deposit`, `withdrawal`, or `correction`. Deposits and withdrawals require a positive amount; corrections accept a signed non-zero amount. Stored `signedAmountMicros` is positive for deposits and negative for withdrawals.

### `DELETE /api/v1/account-adjustments/:id`

Requires auth, CSRF, and `expectedVersion`; soft-deletes the adjustment.

## Offline synchronization

### `GET /api/v1/sync/resources/:type/:id`

Requires authentication. Returns the current owner-scoped record and `version` for conflict comparison:

```json
{ "data": { "resource": { "id": "...", "version": 2 } } }
```

Supported types are `trades`, `accounts`, `instruments`, `tags`, `sessions`, `checklist`, `adjustments`, `journalEntries`, `quickNotes`, `learningCategories`, `learningRecords`, `learningGoals`, `dashboardLayouts`, `posterConfigs`, and `files`. `userId` and internal Mongoose fields are removed. Unsupported types return `400 VALIDATION_ERROR`; missing or foreign records return `404 NOT_FOUND`.

### Idempotency-Key

Offline-safe mutating requests may include an `Idempotency-Key` header with 8–120 URL-safe characters (`[A-Za-z0-9_-]`). The server stores the completed response per owner and key in `sync_operations`. A replay returns the stored status and body with `x-ysj-replayed: true`. Invalid keys return `400 VALIDATION_ERROR`; a concurrent replay returns `409 SYNC_IN_PROGRESS`. The header is ignored on safe methods and on `/auth`, `/onboarding`, `/settings`, `/security`, `/finance`, `/health`, and `/csrf` mutations.

## Error codes

| Code                  | Status | Meaning                                           |
| --------------------- | ------ | ------------------------------------------------- |
| `VALIDATION_ERROR`    | 400    | Invalid request data; `details` lists fields      |
| `FILE_INVALID`        | 400    | Missing, unsupported, or corrupt image file       |
| `FILE_TOO_LARGE`      | 400    | Screenshot or attachment exceeds the 10 MB limit  |
| `FILE_REQUIRED`       | 400    | No image files were supplied                      |
| `FILE_LIMIT`          | 400    | Record already has five active images             |
| `AUTH_REQUIRED`       | 401    | No valid session                                  |
| `SESSION_EXPIRED`     | 401    | Session exceeded inactivity limit                 |
| `INVALID_CREDENTIALS` | 401    | Generic sign-in failure                           |
| `INVALID_PASSWORD`    | 401    | Unlock or password-change verification failed     |
| `CSRF_INVALID`        | 403    | Missing/invalid CSRF token or foreign origin      |
| `NOT_FOUND`           | 404    | Unknown route or unavailable owned record         |
| `CONFLICT`            | 409    | A unique reference value already exists           |
| `VERSION_CONFLICT`    | 409    | The record changed since it was loaded            |
| `SYNC_IN_PROGRESS`    | 409    | A replay with this idempotency key is in progress |
| `DEFAULT_ACCOUNT`     | 409    | The default account cannot be archived            |
| `DEFAULT_LAYOUT`      | 409    | The default dashboard layout cannot be deleted    |
| `SETUP_COMPLETE`      | 409    | Owner already exists                              |
| `RATE_LIMITED`        | 429    | Too many requests                                 |
| `INTERNAL_ERROR`      | 500    | Unexpected server error                           |

## Planned endpoint groups

| Group    | Planned endpoints                                                     |
| -------- | --------------------------------------------------------------------- |
| Accounts | Calculated balance across multiple accounts                           |
| Backups  | Status, connect, disconnect, run, list, verify, restore, recovery key |
| Storage  | Usage, limit, warnings                                                |
| Trash    | List, restore, permanently delete                                     |
| Audit    | Append-only audit history                                             |
| Exports  | Trading, Learning, Journal, full application                          |

## Security requirements

- No endpoint may return Personal Journal data to analytics, dashboard, poster, trading, or learning services. Calendar responses may include only the owner-scoped boolean `hasJournalEntry` when the owner enables `calendarJournalIndicator`.
- Journal routes, services, and models are separate from all other domain modules, and automated tests enforce those import boundaries.
- File endpoints must validate ownership and never accept filesystem paths from clients.
- Error responses must not include stack traces or secrets.
- Security-sensitive changes require tests.
