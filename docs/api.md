# API Reference

Base path: `/api/v1`

**Implemented:** health, onboarding, authentication, settings, and security events. All other groups are planned for later phases.

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
- Mutable records will use `version` / `expectedVersion` optimistic concurrency in later phases.
- Offline-safe mutations will accept `Idempotency-Key`.

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
    "version": "0.2.0",
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
  "dailyStudyTargetMinutes": 60
}
```

## Security events

### `GET /api/v1/security/events?limit=50`

Requires auth. Returns the newest events for the owner plus unattributed security events, limited to 100.

Events: `login_success`, `login_failed`, `logout`, `unlock_success`, `unlock_failed`, `password_changed`, `onboarding_completed`, `rate_limited`, `csrf_rejected`, `session_expired`, `access_denied`.

## Error codes

| Code                  | Status | Meaning                                       |
| --------------------- | ------ | --------------------------------------------- |
| `VALIDATION_ERROR`    | 400    | Invalid request data; `details` lists fields  |
| `AUTH_REQUIRED`       | 401    | No valid session                              |
| `SESSION_EXPIRED`     | 401    | Session exceeded inactivity limit             |
| `INVALID_CREDENTIALS` | 401    | Generic sign-in failure                       |
| `INVALID_PASSWORD`    | 401    | Unlock or password-change verification failed |
| `CSRF_INVALID`        | 403    | Missing/invalid CSRF token or foreign origin  |
| `NOT_FOUND`           | 404    | Unknown route                                 |
| `SETUP_COMPLETE`      | 409    | Owner already exists                          |
| `RATE_LIMITED`        | 429    | Too many requests                             |
| `INTERNAL_ERROR`      | 500    | Unexpected server error                       |

## Planned endpoint groups

| Group       | Planned endpoints                                                     |
| ----------- | --------------------------------------------------------------------- |
| Instruments | CRUD `/instruments`                                                   |
| Tags        | CRUD `/tags`, archive/restore                                         |
| Sessions    | CRUD `/trading-sessions`                                              |
| Accounts    | CRUD `/accounts`, adjustments, balance                                |
| Trades      | CRUD `/trades`, screenshot upload, file view/delete                   |
| Files       | Authenticated file delivery by file ID                                |
| Analytics   | Summary, equity, breakdowns, comparisons, calendar                    |
| Learning    | Categories, records, goals, milestones/tasks, attachments             |
| Journal     | Entries, quick notes, search, reminder settings                       |
| Dashboard   | Layout CRUD, widget data                                              |
| Calendar    | Date-range summaries with filters                                     |
| Posters     | Allowlisted trading/learning poster data                              |
| Backups     | Status, connect, disconnect, run, list, verify, restore, recovery key |
| Storage     | Usage, limit, warnings                                                |
| Trash       | List, restore, permanently delete                                     |
| Audit       | Append-only audit history                                             |
| Exports     | Trading, Learning, Journal, full application                          |
| Sync        | Idempotent replay and conflict responses                              |

## Security requirements

- No endpoint may return Personal Journal data to analytics, dashboard, poster, trading, or learning services.
- File endpoints must validate ownership and never accept filesystem paths from clients.
- Error responses must not include stack traces or secrets.
- Security-sensitive changes require tests.
