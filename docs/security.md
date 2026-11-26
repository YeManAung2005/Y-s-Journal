# Security

> **Status: Phases 1–9 security controls are implemented.** Authentication, sessions, logging, CSRF, rate limiting, owner settings, private trade/file handling, owner-scoped learning records with private attachments, structurally isolated private journal entries and notes, owner-scoped dashboard layouts, neutral calendar markers, and encrypted offline caching/replay are active. Backups arrive in a later phase. Do not expose the development API to the LAN.

## Threat model

The application is a private local system. Primary risks:

- Another device on the same Wi-Fi accessing data without authorization.
- Accidental public exposure or router port forwarding.
- Stolen session cookies.
- Cross-site request forgery.
- Path traversal or unauthorized file access.
- Journal data leaking into analytics, dashboard, posters, or exports.
- Server compromise through uploads or unvalidated input.
- Lost backups or lost encryption credentials.
- Silent offline overwrite of conflicting records.

## Authentication

- One owner account created during onboarding.
- Public registration disabled after setup.
- Email/password login.
- Argon2id password hashing (`m=19456`, `t=2`, `p=1`, 32-byte output).
- Session tokens are 256-bit random values; only SHA-256 hashes are stored.
- Cookie name: `__Host-ysj_sid` in production; `ysj_sid` in development because HTTPS is introduced in Phase 13.
- Cookie flags: HttpOnly, Secure in production, SameSite=Strict, Path `/`.
- Session expires after **7 days of inactivity** and is refreshed at most once per minute.
- Auto-lock after **15 minutes of inactivity**.
- Unlock requires the account password.
- Progressive login delays start at 200 ms, double per failure, and cap at 3 seconds; there is no permanent account lockout.
- Social login is not part of the first release.

## CSRF

- All state-changing requests require CSRF protection.
- CSRF token is validated server-side.
- Same-origin production deployment.
- Origin checks where appropriate.
- No permissive CORS in production.

## Authorization

- Every query is scoped by `userId`.
- Every record and file has an ownership check.
- Dashboard layouts are owner-scoped; a foreign layout ID returns `404 NOT_FOUND`.
- Direct-object references are validated.
- Authorization is never enforced only in the frontend.
- Tests attempt cross-owner access and unauthenticated access.

## Sessions and locking

- Session inactivity is tracked server-side.
- Auto-lock is a client-side privacy lock; the server session may remain active.
- Unlock while online revalidates the password.
- Unlock while offline uses a locally stored verifier and encrypted local cache key.
- Logout revokes the session and clears local cache.
- Password changes invalidate sessions and local caches.

## Offline cache

- Cached query snapshots and queued payloads are encrypted with AES-GCM 256-bit before being written to IndexedDB.
- The AES-GCM key is derived with PBKDF2-SHA-256, 250,000 iterations, and a per-user salt. It is non-extractable, held only in browser memory, and never persisted or sent to the server.
- A separate PBKDF2 derivation is SHA-256 hashed into a local verifier used only for offline unlock. It is not a server credential and does not replace online password validation.
- Lock clears the in-memory key and TanStack Query cache; sign-out additionally clears cached records and queued operations.
- Password change reencrypts queued operations under the new key, updates the verifier, and invalidates old cached queries.
- Service worker caching is limited to the app shell and static assets. Authenticated API responses use `no-store` and are not persisted in the HTTP cache.
- Replayed mutations carry an owner-scoped `Idempotency-Key`; server responses are stored in `sync_operations`, and concurrent replays return `SYNC_IN_PROGRESS`.
- Conflicts require an explicit user decision; no last-write-wins behavior is allowed.

## Rate limiting

Implemented limits:

- Login: 10 attempts per 15 minutes.
- Onboarding, unlock, and password change: 20 requests per 15 minutes.
- All `/api/v1` routes: 600 requests per minute.
- Failed-login delays are per account and independent of IP rate limits.

## Security logs

Recorded events include:

- Successful and failed login.
- Auto-lock and unlock.
- Rate-limit triggers.
- CSRF failures.
- Unauthorized file access attempts.
- Backup connection, run, verification, and restore events.
- Administrator recovery.
- Security-relevant configuration changes.

Logs are redacted. Passwords, passphrases, tokens, cookies, and sensitive journal text must never be logged.

## Local administrator recovery

A local recovery command will:

- Require host console access.
- Require explicit confirmation.
- Reset the owner password.
- Revoke all sessions.
- Write a security event and audit entry.
- Never display existing secrets.

## File security

- Screenshot and learning-attachment bytes are stored under the configured local `storage/uploads` root, never in a static or publicly served directory.
- Generated storage keys with owner/date folders; client-supplied paths and storage keys are rejected.
- Every resolved file path is verified to remain inside the configured storage root.
- Image contents are decoded and re-encoded with Sharp; metadata is stripped.
- Declared MIME type must match decoded JPEG, PNG, or WebP content.
- Size limit is 10 MB per image and five active images per owning record (trade screenshots or learning attachments).
- File bytes are delivered only through `GET /api/v1/files/:id` after session and ownership checks.
- File responses use `no-store`, `nosniff`, and a sanitized inline filename.
- Foreign or missing file IDs return `404` and record `access_denied`.
- Soft delete is implemented; 30-day trash purge is planned for Phase 11.

## Learning isolation

- Learning services query only owner-scoped learning categories, records, goals, and their private files.
- Learning attachments are delivered only through `GET /api/v1/files/:id` after session and ownership checks; no static directory is exposed.
- Deleting a learning record soft-deletes only attachments marked as deleted by that record; manually deleted files stay deleted.
- Learning data is never read by trading analytics, the trading journal, or dashboard services.
- Personal Journal models are never imported by learning services.

## Dashboard and calendar isolation

- Dashboard layouts are owner-scoped and mutations require CSRF plus `expectedVersion`. Stale version checks return `409 VERSION_CONFLICT`; the current default layout cannot be deleted and returns `409 DEFAULT_LAYOUT`.
- Dashboard widget data comes only from trading analytics, learning summaries/goals, and calendar activity. Personal Journal content is never included.
- Calendar aggregation reads owner-scoped active trades and learning records. Journal entries are consulted only when the owner enables `calendarJournalIndicator`, and only their dates are read.
- The only journal-derived value in a calendar response is the boolean `hasJournalEntry`, and it is omitted entirely while the marker setting is off. Another owner's entries are never marked.
- Dashboard and calendar responses never include journal text, mood, gratitude, notes, priorities, or attachments.

## HTTP security

- Helmet security headers.
- Strict CSP.
- No stack traces in production.
- JSON body size limits.
- Zod validation.
- No `eval`, no dynamic code execution.
- React escaping and sanitized Markdown.
- File downloads use safe content disposition.
- HTTPS in production with a trusted local certificate.
- MongoDB remains localhost-only.

## Personal Journal isolation

The journal is implemented and structurally isolated:

- Separate models (`journal_entries`, `quick_notes`), service, routes, and UI.
- Not imported by analytics, dashboard, poster, trading, or learning services.
- Journal search queries only the authenticated owner's active journal entries and quick notes.
- Poster data uses an explicit allowlist.
- Poster Studio reads only trading analytics, learning summaries, or one explicitly selected owner-scoped completed trade. Its service imports no journal model, returns no journal content fields, and writes poster configs to an owner-scoped `poster_configs` collection.
- A `trade` poster requires an active trade owned by the authenticated user. Unknown or foreign `tradeId` values return `404` from the data endpoint and fail config save with `400 VALIDATION_ERROR`; trade poster responses expose no trade notes, lessons, review, emotions, rule violations, or screenshots.
- PNG poster export runs on a client-side canvas and downloads locally; no poster image or poster data is uploaded.
- Calendar journal markers are off by default and neutral when enabled: `hasJournalEntry` is an owner-scoped boolean with no journal content.
- Reminders contain no journal content; the setting stores only an enabled flag and time.
- Audit diffs redact journal text.
- Automated privacy tests inspect service imports and seed foreign-owned journal records to verify that journal data cannot appear elsewhere.

## Backup security

- User passphrase is never stored.
- Argon2id derives a key-encryption key.
- AES-256-GCM authenticated encryption.
- Random 256-bit Backup Data Key.
- Optional recovery key.
- Optional Windows DPAPI auto-unlock wrapper for unattended backups.
- Only encrypted bytes are uploaded to Google Drive.
- Backup verification includes integrity, decryption, manifest, and dry-run restore.
- Safety backup before restore.
- No silent merging.

## Future multi-user readiness

All owned documents and queries carry `userId`. The first release enforces a single owner, but the schema and authorization layer are prepared for multiple users.
