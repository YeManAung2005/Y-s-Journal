# API Reference

Base path: `/api/v1`

> **Implemented in Phase 0:** `GET /api/v1/health` only. All other groups are planned for later phases.

## Conventions

- JSON requests and responses.
- Success envelope: `{ "data": ..., "meta": ... }`.
- Error envelope:

```json
{
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Human-readable summary.",
    "details": {},
    "requestId": "uuid"
  }
}
```

- Mutating requests will require CSRF protection and authentication.
- Mutable records will use `version` / `expectedVersion` optimistic concurrency.
- Offline-safe mutations will accept `Idempotency-Key`.
- Lists will use explicit pagination.
- Server-side ownership checks apply to every record and file.
- Backend errors use stable codes that the client translates.

## Health

### `GET /api/v1/health`

Public, unauthenticated status endpoint. Used by the local UI and service checks. It returns no secrets or file paths.

Healthy response — HTTP `200`:

```json
{
  "data": {
    "status": "ok",
    "service": "ys-journal-api",
    "version": "0.1.0",
    "environment": "production",
    "mongo": "up",
    "uptimeSeconds": 42,
    "timestamp": "2026-11-24T04:00:00.000Z"
  }
}
```

Degraded response — HTTP `503`:

```json
{
  "data": {
    "status": "degraded",
    "service": "ys-journal-api",
    "version": "0.1.0",
    "environment": "production",
    "mongo": "down",
    "uptimeSeconds": 42,
    "timestamp": "2026-11-24T04:00:00.000Z"
  }
}
```

Every response includes an `x-request-id` header. A structured 404 is returned for unknown API routes.

## Planned endpoint groups

| Group       | Planned endpoints                                                                 |
| ----------- | --------------------------------------------------------------------------------- |
| Onboarding  | `POST /onboarding`, `GET /onboarding/status`                                      |
| Auth        | `POST /auth/login`, `POST /auth/logout`, `POST /auth/unlock`, `GET /auth/session` |
| Settings    | `GET/PATCH /settings`, checklist and dashboard settings                           |
| Instruments | CRUD `/instruments`                                                               |
| Tags        | CRUD `/tags`, archive/restore                                                     |
| Sessions    | CRUD `/trading-sessions`                                                          |
| Accounts    | CRUD `/accounts`, adjustments, balance                                            |
| Trades      | CRUD `/trades`, screenshot upload, file view/delete                               |
| Files       | Authenticated file delivery by file ID                                            |
| Analytics   | Summary, equity, breakdowns, comparisons, calendar                                |
| Learning    | Categories, records, goals, milestones/tasks, attachments                         |
| Journal     | Entries, quick notes, search, reminder settings                                   |
| Dashboard   | Layout CRUD, widget data                                                          |
| Calendar    | Date-range summaries with filters                                                 |
| Posters     | Allowlisted trading/learning poster data                                          |
| Backups     | Status, connect, disconnect, run, list, verify, restore, recovery key             |
| Storage     | Usage, limit, warnings                                                            |
| Trash       | List, restore, permanently delete                                                 |
| Audit       | Append-only audit history                                                         |
| Exports     | Trading, Learning, Journal, full application                                      |
| Sync        | Idempotent replay and conflict responses                                          |

## Security requirements

- Authentication and ownership checks are server-side.
- No endpoint may return Personal Journal data to analytics, dashboard, poster, trading, or learning services.
- File endpoints must validate ownership and never accept filesystem paths from clients.
- Error responses must not include stack traces or secrets.
- Rate limits apply to login, uploads, exports, backup operations, and expensive analytics.
