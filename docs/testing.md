# Testing

## Current tests

Version 0.10.1 compact-layout verification: 32 test files / 185 tests passing, lint clean, production build succeeding with a generated service worker, and formatting clean.

- `tests/integration/health.test.js`
  - Healthy API response.
  - Degraded response when MongoDB is unavailable.
  - Structured API 404 without stack leakage.
  - Request ID response header.
- `tests/unit/health-pill.test.jsx`
  - Healthy, offline, and fallback UI states.
- `tests/unit/security-helpers.test.js`
  - Argon2id hashing and verification.
  - Token hashing and constant-time comparison.
  - Progressive delay bounds.
  - IANA time zone validation.
  - 15-minute idle boundary.
- `tests/unit/validation.test.js`
  - Owner onboarding rules, password strength, settings strictness, and password-change rules.
- `tests/integration/auth.test.js`
  - One-time owner onboarding, defaults, and cookie attributes.
  - Sign-in success/failure, login-failure logging, and session checks.
  - Authentication requirements and session expiry.
  - Logout, unlock, password change, and other-session revocation.
  - Settings validation and persistence.
  - CSRF origin checks and rate limiting.
  - Production `__Host-` cookie attributes.
- `tests/unit/financial-engine.test.js`
  - Canonical unit conversion and validation.
  - Largest-remainder fee allocation.
  - All worked fixtures: NQ long, ES short, fractional MNQ, manual risk, break-even, and missing fees.
  - Invalid stop and exit-quantity rejection.
  - Request normalization into canonical units.
- `tests/integration/reference.test.js`
  - Approved reference-data bootstrap.
  - Authentication and CSRF enforcement.
  - Tag/session/checklist CRUD, archive/restore, and optimistic concurrency.
  - One editable default account rules.
  - Built-in instrument configuration and duplicate/invalid specification rejection.
  - Server-authoritative calculator endpoint.
- `tests/unit/trade-validation.test.js`
  - Zod defaults, duplicate-tag rejection, and review normalization.
  - Canonical conversion with the server instrument spec and off-tick price rejection.
  - `expectedVersion` requirement on updates.
- `tests/unit/trade-form-utils.test.js`
  - Blank optional fee/stop/risk fields stay `null` instead of becoming zero.
  - Explicit zero and trimmed values are preserved.
- `tests/integration/trades.test.js`
  - Authentication, CSRF, and trade-ID boundary validation.
  - Authoritative calculations, immutable snapshots, and missing-fee behavior.
  - Off-tick rejection, optimistic concurrency, and unchanged historical calculations.
  - Soft delete/restore and trade-deleted screenshot state.
  - Private screenshot upload, view, delete, invalid-image rejection, and per-trade limit.
- `tests/unit/analytics-service.test.js`
  - Profit factor edge cases, win rate, streaks, drawdown, and missing-data coverage.
- `tests/integration/analytics.test.js`
  - Analytics authentication and query validation.
  - Net/gross summaries, filters, breakdowns, comparisons, and ownership isolation.
  - Strict missing-fee and missing-risk behavior.
  - One equity point per trade, including trades that share a date.
  - Equity and account-balance curves with deposits, withdrawals, and corrections.
  - Account-adjustment validation, soft delete, and owner scoping.

- `tests/unit/learning-streaks.test.js`
  - Consecutive-day streaks against the daily study target.
  - Yesterday's streak when today does not qualify.
  - Same-day aggregation and a zero daily target.
  - Filtered totals without changing all-time streaks.
  - Calendar-date resolution in the configured IANA time zone.
- `tests/unit/learning-validation.test.js`
  - Record defaults and nullable goal links.
  - HTTP(S)-only resource URLs and patch schemas that avoid silent resets.
  - Category colors, goal defaults, and versioned nested updates.
- `tests/integration/learning.test.js`
  - Authentication, CSRF, ID validation, and owner isolation.
  - Category CRUD, archive/restore, duplicate slugs, and optimistic concurrency.
  - Record create/edit/filter, immutable category snapshots, soft delete, and restore.
  - Private learning attachment upload, view, delete, restore, invalid input, and per-record limit.
  - Goal CRUD, milestones, tasks, server-calculated progress, completion, and stale-version rejection.
  - Daily study totals, target qualification, and current/longest streaks in the app time zone.

- `tests/unit/journal-validation.test.js`
  - Entry defaults, mood/list bounds, patch requirements, note text, and search query validation.
  - Structural privacy assertions that journal models are absent from trading, analytics, learning, and file services, and that journal services import no other domain models.
- `tests/integration/journal.test.js`
  - Authentication, CSRF, owner isolation, and foreign-record rejection.
  - Entry create/list/update/delete/restore, one-entry-per-date, and stale-version conflicts.
  - Quick-note create/edit/delete/restore and owner scoping.
  - Private search over active entries and notes, scope filters, and exclusion of deleted records.
  - Reminder setting persistence and invalid reminder-time rejection.

- `tests/unit/dashboard-calendar-validation.test.js`
  - Supported widget IDs, layout defaults, and strict widget settings for basis and day window.
  - `expectedVersion` and patch-field requirements, dashboard/calendar query strings, and month-format validation.
  - Structural privacy assertion that calendar aggregation does not reference journal content fields.
- `tests/integration/dashboard-calendar.test.js`
  - Authentication, CSRF, and validation of dashboard and calendar queries.
  - Default layout creation, layout CRUD, default switching, delete protection, and stale-version conflicts.
  - Foreign layout IDs return `404` for reads, updates, and deletes.
  - Widget data from trades, study, and goals without exposing journal content, including the 365-day activity-calendar array used by the full-width heatmap.
  - Calendar month aggregation, net P&L unavailability, the optional neutral journal marker, and owner isolation.

- `tests/unit/poster-validation.test.js`
  - Poster create defaults, supported types/templates/dimensions/colors, and day bounds.
  - Trade poster `tradeId` requirements, patch and delete version requirements, and poster data query coercion.
  - Structural privacy assertion that the poster service imports no journal model or journal/trade content field.
- `tests/unit/poster-renderer.test.js`
  - Every template and canvas size draws without throwing.
  - Null money and percent values stay **Unavailable** instead of becoming zero; other metric kinds format correctly.
  - Single-trade posters render generated subtitles and signed percent/multiple ROI values.
  - Long text wraps and truncates, and PNG file names are sanitized.
- `tests/integration/posters.test.js`
  - Authentication, CSRF, and poster query validation.
  - Template/dimension catalog and poster config CRUD with duplicate-name and stale-version rejection.
  - Foreign poster configs return `404` and never appear in the owner's list.
  - Trading and learning poster metrics, streak calculation, net-basis handling, and journal-content exclusion.
  - Single-trade ROI on gross/net basis, unknown or foreign trade IDs, missing `tradeId` rejection, and private trade content exclusion.

- `tests/unit/offline-crypto.test.js`
  - Base64 round-trips including padded input.
  - Non-extractable AES-GCM key derivation and encrypted JSON round-trip.
  - Wrong-key and modified-payload decryption failures.
  - Stable verifier derivation and constant-time comparison.
- `tests/unit/offline-store.test.js`
  - Local verifier and offline unlock without storing the password.
  - Encrypted cached records and queued operations; locked cache rejection.
  - Client-generated record IDs for creates.
  - Password-change key rotation and cache invalidation.
  - Allowlisted query persistence and restore.
- `tests/unit/offline-queue.test.js`
  - Queue status, ordered replay, conflict pausing, network retry behavior, blocked operations, and user conflict choices.
- `tests/unit/offline-api.test.js`
  - Offline mutation queueing, `OFFLINE_QUEUED`, excluded auth routes, network-failure queueing, and read exclusion.
- `tests/unit/offline-resources.test.js`
  - Conflict resource path mapping.
- `tests/unit/offline-status.test.jsx`
  - Status labels, conflict actions, blocked details, quota errors, and the offline unlock form.
- `tests/unit/app-update.test.jsx`
  - App-shell explanation, clickable update check, pending update activation, and offline-ready status.
- `tests/unit/settings-layout.test.jsx`
  - Each Settings section renders exactly once, guarding against duplicated cards from stale app chunks.
- `tests/unit/compact-layout.test.jsx`
  - No Calendar link in the desktop sidebar or mobile header.
  - Trading Setup, Analytics, Learning, and Daily Journal open in view/analytics mode with forms hidden.
  - Add/edit actions reveal forms, and **Show optional fields** reveals optional inputs.
- `tests/integration/sync.test.js`
  - Owner-scoped resource versions, unknown/foreign records, idempotent replay, invalid keys, and `SYNC_IN_PROGRESS`.

Integration tests connect to `MONGODB_TEST_URI` (default `mongodb://127.0.0.1:27017/ys_journal_test`) and drop that database. They never touch `ys_journal`. Screenshot and learning-attachment integration tests use `storage/test-storage` and remove it before and after the suite.

Commands:

```powershell
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run verify
```

## Required future coverage

### Unit

- Account balances across multiple accounts.
- Date/time-zone boundaries for grouped analytics.
- Storage calculations.

### Integration

- API contracts.
- Authentication and authorization.
- Ownership isolation.
- Database operations.
- Cross-owner file access and path-traversal attempts.
- Audit history.
- Backup creation, verification, and restore.

### End-to-end

- First launch and onboarding.
- Owner account creation.
- Trade recording with partial exits.
- Trade editing.
- Learning records and goals.
- Daily journal.
- Calendar.
- Poster export (renderer unit tests and manual browser export are implemented; automated browser E2E remains planned).
- Backup and restore.

### Security and privacy

- Unauthenticated access.
- Cross-owner record and file access.
- CSRF.
- Session expiry.
- Rate limits.
- Path traversal.
- File upload content and ownership checks.
- Personal Journal leakage into analytics, dashboard, posters, calendar, and exports.
- No journal content in logs or notifications.

### Browser

- Chrome.
- Edge.
- Desktop and mobile viewports.
- Accessibility checks.
- Reduced motion.
- Keyboard navigation.

### Windows

- Installer.
- Service start/restart.
- Sleep/wake recovery.
- LAN access.
- Certificate trust.
- Firewall scope.
- MongoDB not exposed.
- Backup scheduler.

## Financial fixtures

The deterministic fixtures are documented in [financial-calculations.md](financial-calculations.md). They cover NQ, ES, MNQ, MES, long, short, multiple exits, fractional quantities, fees, manual risk overrides, break-even, equity, deposits, withdrawals, and corrections.

## Test data

- Use generated test data only.
- Do not use real journal content.
- Keep generated screenshots and reports in local test output only.
- Tests must clean up their own records.
- Integration tests use a dedicated test database or dependency injection, never the live user database.

## Honesty rule

A test is reported as passing only after the command has actually run and passed. Failures and unfinished areas must be reported.
