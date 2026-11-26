# Changelog

All notable changes are documented here.

## [0.10.1] — 2026-11-26

### Changed

- Removed Calendar from the desktop sidebar and mobile header. The Calendar route remains available at `/calendar`.
- Trading Setup, Analytics, Learning, and Daily Journal now open in view/analytics mode. Calculator, account adjustment, category, goal, study record, journal entry, and quick-note forms are revealed by deliberate section actions.
- Added a consistent **Show optional fields** disclosure for secondary inputs across those forms, including fees/stop/risk, adjustment notes, colors and ordering, goal details, study extras, journal prompts, and quick-note dates.
- Daily Journal no longer opens an editor automatically when today's entry is missing.

### Added

- `tests/unit/compact-layout.test.jsx` verifies the missing Calendar navigation, default view state, reveal actions, and optional-field disclosures.
- Updated the user guide, troubleshooting guide, testing guide, and README for the compact page layout.

### Verified

- `npm.cmd run verify` passed locally: lint clean, 32 test files / 185 tests passing, and the production build generated the service worker.
- `npm.cmd run format:check` passed locally with all matched files using Prettier code style.

## [0.10.0] — 2026-11-26

### Added — Phase 9 offline synchronization

- Workbox service worker caches the app shell and static assets only; authenticated API responses are never cached in the HTTP cache.
- Encrypted Dexie IndexedDB cache for allowlisted query snapshots, queued mutations, and a local unlock verifier.
- AES-GCM encrypted payloads with a non-extractable PBKDF2-SHA-256 key held only in memory; auto-lock clears the key and query cache.
- Offline mutation queue with idempotency keys, client-generated create IDs, expected-version snapshots, ordered replay, explicit quota errors, and user-resolved conflicts.
- `GET /api/v1/sync/resources/:type/:id` for current owner-scoped versions and idempotent replay storage in `sync_operations` with `SYNC_IN_PROGRESS` protection.
- Status panel with Offline, Pending, Syncing, Synced, Conflict, and Blocked states and conflict actions.

### Changed

- Sign-in, onboarding, unlock, password change, lock, and sign-out now manage the offline key lifecycle.
- App-shell update controls moved to Settings → App update, with an explanation that only static app files change, a **Check for updates** action, and an **Update now** action.
- Corrected the React service worker hook to read its state tuples instead of treating them as booleans.
- Offline unlock, sync status, conflict review, and quota messages moved to Settings → Offline and sync; no offline reminder is shown on other pages.
- Development no longer registers an app-shell service worker; stale dev workers and cached app files are cleared on each dev page load to prevent duplicated settings cards from mixed chunks.
- Backups and the Windows installer remain planned for later phases.
- Bumped version to `0.10.0` and updated offline, API, schema, security, environment, testing, user, troubleshooting, architecture, README, and implementation-plan documentation.

### Verified

- 31 test files / 179 tests passing, lint clean, production build succeeding with a generated service worker, and formatting clean.

## [0.9.1] — 2026-11-26

### Added — single-trade ROI poster

- Added a `trade` poster type that selects one active, owner-scoped completed trade via `tradeId`.
- Trade posters show ROI on risk, selected-basis P&L, R multiple, and risked amount, with gross/net basis support.
- The Poster Studio UI lists completed trades, explains ROI on risk, and blocks saving without a selected trade.
- Added tests for trade poster validation, ROI rendering, allowlisted trade data, unknown/foreign trade IDs, and private trade content exclusion.

### Changed

- Extended poster configs, catalog, data API, renderer, and documentation for single-trade ROI.
- Trade data remains an explicit allowlist: trade notes, lessons, review, emotions, rule violations, and screenshots are never read or returned.
- Bumped version to `0.9.1`.

### Verified

- 22 test files / 144 tests passing, lint clean, production build succeeding, and formatting clean.

## [0.9.0] — 2026-11-26

### Added — Phase 8 Poster Studio

- Poster Studio at `/posters` with a live canvas preview, three visual templates (`midnight`, `paper`, `ember`), three canvas sizes (square 1080×1080, portrait 1080×1350, story 1080×1920), accent colors, logo placement, and text overrides.
- Owner-scoped `poster_configs` with create, list, update, delete, unique names, and optimistic concurrency.
- `GET /api/v1/posters/catalog` for templates, dimensions, poster types, and defaults.
- `GET /api/v1/posters/data` for explicitly allowlisted trading or learning poster metrics, including 7–365-day periods and gross/net P&L.
- Local PNG export rendered from the same canvas as the live preview; no poster image or poster data is uploaded.
- Unit and integration tests for poster validation, renderer behavior, config CRUD, owner isolation, version conflicts, and journal-content exclusion.

### Changed

- Poster data reads only trading analytics or learning summaries. Journal models and journal content fields are never imported or returned.
- Bumped version to `0.9.0` and updated API, architecture, schema, security, testing, user, troubleshooting, implementation-plan, README, and changelog documentation.

### Verified

- 22 test files / 139 tests passing, lint clean, and production build succeeding.

## [0.8.0] — 2026-11-25

### Added — Phase 7 custom dashboard and calendar

- Custom Dashboard at `/` replaces the old Foundation/Overview page with four configurable widgets: `trades_summary`, `study_summary`, `calendar_activity`, and `goals_progress`.
- `GET /api/v1/dashboard/widgets` exposes widget IDs, descriptions, default sizes, and default settings.
- Authenticated dashboard layout and data endpoints with owner scoping, an automatic default layout, per-widget visibility/size/position/settings, and optimistic concurrency.
- Calendar enabled at `/calendar` with month navigation and daily trading/study totals. `GET /api/v1/calendar/month?month=YYYY-MM` returns month bounds, a summary, and per-day activity.
- Settings gained the boolean `calendarJournalIndicator`, default `false` and labeled **Calendar journal marker**, which reveals a neutral journal-day marker in the calendar.
- Unit and integration tests for layout CRUD, version conflicts, owner isolation, widget data, calendar aggregation, and journal-content privacy boundaries.

### Changed

- Refined the Dashboard layout: layout creation now uses a compact **New layout** button and inline name field instead of a full layout card. The activity widget is now a full-width, GitHub-style 12-month heatmap that fills active days with color, and study-rhythm metric cards use an even responsive grid with consistent heights.
- Dashboard widgets are assembled only from trading analytics, learning summaries/goals, and calendar aggregation. Personal Journal content is never included in dashboard widgets or calendar responses; the optional `hasJournalEntry` marker is a neutral, owner-scoped boolean and returns no journal text, mood, gratitude, notes, priorities, or attachments.
- Bumped version to `0.8.0` and updated API, schema, security, testing, user, troubleshooting, installation, architecture, and implementation-plan documentation.

### Verified

- 19 test files / 124 tests passing, lint clean, and production build succeeding.

## [0.7.0] — 2026-11-25

### Added — Phase 6 personal daily journal

- Owner-scoped daily journal entries with highlights, challenges, lessons, gratitude, mood, reflection, free writing, and tomorrow's priorities. One active entry is kept per date.
- Quick notes with their own dates, editing, and soft delete/restore.
- Private search across journal entries and quick notes with scope and date filters. Deleted records are never searched.
- Daily journal reminder settings in Settings and a local in-app reminder on the Daily Journal page. Reminders contain no journal content.
- Authenticated `GET/POST/PATCH/DELETE /api/v1/journal/entries`, `/journal/notes`, `/journal/search`, and restore routes, with CSRF and optimistic concurrency.
- Daily Journal workspace UI with a daily entry form, quick notes, search, recent entries, restore controls, and a reminder banner.
- Unit and integration coverage for validation, ownership isolation, privacy boundaries, reminders, soft delete/restore, and stale-version rejection.

### Changed

- Extended settings validation and persistence to accept owner reminder preferences without exposing journal content.
- Refined the Daily Journal edit flow: saving now closes the form and shows a confirmation instead of leaving saved text in the inputs, and Edit actions scroll back to the form automatically.
- Added a Daily Journal navigation item and mobile header shortcut.
- Bumped version to `0.7.0` and updated API, schema, security, testing, user, troubleshooting, installation, architecture, and implementation-plan documentation.

### Verified

- `npm.cmd run verify`: lint clean, 17 test files / 112 tests passing, production build succeeding.
- `npm.cmd run format:check`: clean.

## [0.6.0] — 2026-11-25

### Added — Phase 5 learning tracker

- Owner-scoped learning categories with create/edit, archive/restore, unique slugs, and optimistic concurrency.
- Study records with immutable category snapshots, optional goal links, duration, notes, HTTP(S) resource links, soft delete/restore, and version checks.
- Private learning attachments re-encoded with Sharp, limited to five 10 MB JPEG/PNG/WebP images per record, delivered only through authenticated file URLs.
- Learning goals with embedded milestones and tasks, server-calculated progress, completion status, soft delete/restore, and versioned nested updates.
- Daily study totals and current/longest streaks computed from active records in the configured app time zone. A zero daily target means any positive study time qualifies.
- Authenticated `GET/POST/PATCH/DELETE /api/v1/learning/categories`, `/learning/records`, `/learning/goals`, nested milestone/task routes, attachment upload, and `GET /learning/summary`.
- Learning workspace UI with streak chart, category manager, filtered record list, record form, attachments, and goals/milestones/tasks.
- Unit and integration tests for streaks, validation, ownership isolation, attachments, goals, and concurrency.

### Changed

- Generalized private file ownership to `Trade` and `LearningRecord` with matching deletion reasons and restore behavior.
- Bumped version to `0.6.0` and updated API, schema, security, testing, user, troubleshooting, installation, architecture, and implementation-plan documentation.

### Verified

- `npm.cmd run verify`: lint clean, 15 test files / 95 tests passing, production build succeeding.
- `npm.cmd run format:check`: clean.

## [0.5.0] — 2026-11-25

### Added — Phase 4 trading analytics

- Server-authoritative summary, filters, breakdowns, period comparisons, equity curves, drawdown, daily outcomes, and win/loss streaks derived only from completed trades.
- Strict net unavailability when any selected trade has missing fees, with explicit coverage counts and separate gross values.
- Average R with risk coverage; profit factor edge cases return `Infinity`, `0`, or unavailable exactly as specified.
- Owner-scoped account adjustments for deposits, withdrawals, and signed corrections, included in account balance but never trading P&L.
- Equity points combining starting balance, all completed net trade P&L, and adjustments, with unavailable values propagated after missing-fee trades.
- Analytics UI with shared filters, metric cards, SVG equity curve, breakdown table, period comparison, and adjustment management.
- Equity curves now emit one point per filtered trade so every trade moves the curve, including multiple trades on the same date.
- Blank fee, stop, and risk fields normalize to `null`; an omitted fee is never defaulted to zero.
- Authenticated `GET /analytics/summary`, `GET /analytics/equity`, `GET /analytics/breakdowns`, `GET /analytics/compare`, account-adjustment routes, and owner-isolation tests.

### Changed

- Bumped version to `0.5.0` and updated API, schema, financial, testing, user, installation, and implementation-plan documentation.

### Verified

- `npm.cmd run verify`: lint clean, 12 test files / 79 tests passing, production build succeeding.
- `npm.cmd run format:check`: clean.

## [0.4.0] — 2026-11-24

### Added — Phase 3 trading journal core

- Completed-trade CRUD with one entry, multiple partial exits, fees, automatic/manual risk, gross R, outcome classification, and immutable account/instrument/session/tag/checklist snapshots.
- Trade review fields, emotions, rule violations, notes, lessons, optimistic concurrency, soft delete, and restore.
- Private JPEG/PNG/WebP screenshots re-encoded with Sharp, metadata stripped, generated storage keys, owner-only delivery, a 10 MB per-file limit, and a five-screenshot-per-trade limit.
- Authenticated `GET/POST/PATCH/DELETE /api/v1/trades`, screenshot upload/restore endpoints, and authenticated `GET/DELETE /api/v1/files/:id`.
- Trading journal list, create/edit form, and detail UI with calculated summaries, review display, screenshots, and trash actions.
- Phase 3 unit and integration tests for validation, calculations, snapshots, concurrency, deletion, and private file handling.

### Changed

- Added and pinned `multer@2.5.0` and `sharp@0.35.5`.
- Updated API, schema, security, testing, user, troubleshooting, environment, and workflow documentation for the implemented trading journal.
- Documentation now describes a local-only workflow with no remote repository step.

### Verified

- `npm.cmd run verify`: lint clean, 9 test files / 62 tests passing, production build succeeding.
- `npm.cmd run format:check`: clean.

## [0.3.0] — 2026-11-24

### Added — Phase 2 financial engine and reference data

- Server-authoritative financial engine using integer micro-USD, ticks, and quantity hundredths with `decimal.js` for ratios and averages.
- Approved formulas for partial exits, gross/net P&L, largest-remainder fee allocation, automatic/manual risk, R-multiple, weighted average exit, and outcome classification.
- Missing fees and missing risk remain explicit `null` values; they are never treated as zero or invented.
- Built-in NQ, MNQ, ES, and MES instrument specifications with editable configurations and immutable historical snapshots planned for trades.
- One editable default `Main Account` with a `$0.00` starting balance and no sample trades.
- Owner-managed trading accounts, tags, trading sessions, and pre-trade checklist items with archive/restore and optimistic concurrency.
- Authenticated `GET /api/v1/reference` bootstrap and `POST /api/v1/finance/calculate` preview endpoint.
- Trading setup UI with reference-data management and a server-backed financial calculator.
- Phase 2 unit and integration tests covering all worked fixtures from the financial specification.

### Changed

- New Phase 2 collections are scoped to the owner and excluded from other modules.
- Documentation now marks the financial engine and reference data as implemented.

## [0.2.0] — 2026-11-24

### Added — Phase 1 security and settings

- One-time owner onboarding with Argon2id password hashing and password strength rules.
- Login, logout, unlock, and password-change endpoints with progressive delays.
- Hashed, HTTP-only, SameSite session cookies with a 7-day inactivity expiry.
- 15-minute client-side auto-lock with password unlock.
- CSRF double-submit tokens and origin verification, with hardened `__Host-` cookies in production.
- Login, onboarding, security-action, and global API rate limiting.
- Append-only security event log with owner-scoped viewing.
- Owner settings for theme, text size, reduced motion, app/trading time zone, and daily study target.
- React auth gate with setup, login, lock, and error screens.
- Phase 1 unit and integration tests using a dedicated MongoDB test database.

### Changed

- Application shell now shows the owner, lock, sign-out, and Settings navigation.
- Overview now reflects the authenticated owner and Phase 1 security baseline.

## [0.1.0] — 2026-11-24

### Added — Phase 0 foundation

- Created the project at `C:\Users\real_yezz\Documents\YsJournal`.
- Added the React 19 + Vite 8 + JavaScript + Tailwind 4 + shadcn/ui-style foundation.
- Added TanStack Router and TanStack Query.
- Added the Express 5 API with health endpoint and MongoDB ping.
- Added Pino structured logging and Helmet security headers.
- Added MongoDB connectivity verification script.
- Added Vitest, Supertest, React Testing Library, ESLint, and Prettier.
- Added the initial Overview page and responsive application shell.
- Added architecture, environment, schema, API, financial, security, backup, offline, testing, workflow, installation, Windows, user, and troubleshooting documentation.
- Added local exclusions for secrets, data, screenshots, backups, certificates, and build output.

### Verified

- MongoDB connectivity: `ys_journal` at `127.0.0.1:27017`, MongoDB `9.0.4`.
- 7 automated tests passing.
- Lint passing without errors.
- Production build succeeding.

### Not implemented yet

- Authentication and onboarding.
- Trading journal.
- Learning tracker.
- Personal journal.
- Analytics.
- Dashboard widgets.
- Calendar.
- Poster Studio.
- Offline synchronization.
- Google Drive backups.
- Exports.
- Windows installer and service.
