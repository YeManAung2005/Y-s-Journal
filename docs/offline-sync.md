# Offline Synchronization

> **Status: implemented in Phase 9 / version 0.10.0.** Offline support is browser-only and requires a previously configured local cache on a trusted device.

## Scope

Basic offline support for the local network application:

- View previously accessed records while the host is unreachable.
- Queue supported changes on a secondary device or the host.
- Sync automatically when the host becomes reachable.
- Preserve pending changes until confirmed.
- Ask the user to resolve conflicts.
- Never silently overwrite conflicting data.
- Never present unconfirmed changes as synchronized.

## Service worker

- `vite-plugin-pwa` generates a Workbox service worker from the production Vite build.
- The development server does not register this worker; stale dev workers and cached app files are cleared on each dev page load.
- The service worker precaches the application shell and hashed static assets.
- Navigation requests fall back to `index.html`, but `/api/*` is denylisted from the navigation fallback.
- No runtime API caching is configured. Authenticated API responses continue to use `Cache-Control: no-store` and client `fetch({ cache: 'no-store' })`.
- `index.html` and SPA fallback responses remain `no-store`.
- Settings → **App update** shows shell status, explains that only static app files are replaced, offers **Check for updates**, and activates a pending shell with **Update now**. No PWA installation is required.
- No web app manifest is emitted and no PWA installation is required.

## IndexedDB cache

- Dexie database: `ys-journal-offline`.
- Stores: `cache` (encrypted query snapshots), `operations` (encrypted queued mutations), and `profiles` (local unlock identity and verifier).
- Sensitive cached payloads and queued payloads are encrypted with AES-GCM 256-bit.
- The AES-GCM key is derived from the owner password with PBKDF2-SHA-256, 250,000 iterations, and is non-extractable. It is held only in module memory and is never written to IndexedDB or sent to the server.
- A separate PBKDF2 derivation is hashed with SHA-256 to produce the local verifier. The verifier is used only for offline unlock and is separate from server authentication.
- Auto-lock clears the in-memory key and the TanStack Query cache.
- Sign-out additionally clears encrypted cached records and queued operations.
- A password change reencrypts queued operations under the new key, updates the verifier, and discards old query snapshots.
- Offline boot with a stored verifier opens the lock screen; unlocking recreates the in-memory key from the password.
- Query snapshots are persisted only for allowlisted, successful query keys: `trades`, `analytics`, `reference`, `learning`, `journal`, `dashboard`, `calendar`, `posters`, and `files`. Authentication, settings, security, and finance queries are never persisted.

## Queue model

Each queued operation includes:

- Client-generated operation ID, used as the idempotency key.
- HTTP method and path.
- Payload, including `FormData` file parts encoded inside the encrypted record when browser quota allows.
- Client-generated record ID for POST creates.
- Expected record version and base snapshot when the caller supplied `expectedVersion`.
- Status (`pending`, `conflict`, or `blocked`), error details, timestamp, and sequence order.

Quota failures are surfaced explicitly in **Settings → Offline and sync**. Pending operations are never silently discarded.

## Sync protocol

1. Reachability is tracked with `navigator.onLine`, `online`, and `offline` events.
2. Reconnect and successful authentication trigger a replay attempt.
3. Queued operations are replayed in sequence order with `Idempotency-Key` and a refreshed CSRF token.
4. The server validates authentication, ownership, validation rules, and expected version through the existing domain routes.
5. The server stores a completed response in `sync_operations`; a replay with the same owner and key returns that response without applying the change again.
6. The client removes an operation only after a successful server response.
7. A `409 VERSION_CONFLICT`, `409 CONFLICT`, or `409 SYNC_IN_PROGRESS` marks the operation as a conflict, keeps the local copy, pauses dependent operations, and requires a user decision.
8. The user chooses **Keep server**, **Use mine**, **Merge manually**, or **Discard**. **Use mine** fetches the current server version from `GET /api/v1/sync/resources/:type/:id` before requeueing the local payload.

There is no automatic last-write-wins policy. A non-conflict rejection is marked **Blocked** and shown with its server message.

## Server endpoints

### `GET /api/v1/sync/resources/:type/:id`

Requires authentication. Returns `{ "data": { "resource": { ... } } }` with the current owner-scoped record and `version` for conflict comparison. `userId` and internal Mongoose fields are removed. Unsupported types return `400 VALIDATION_ERROR`; missing or foreign records return `404 NOT_FOUND`.

### Idempotency-Key header

Supported on offline-safe mutating routes under `/api/v1`, excluding `/auth`, `/onboarding`, `/settings`, `/security`, `/finance`, `/health`, and `/csrf`. Keys must match 8–120 URL-safe characters. Invalid keys return `400 VALIDATION_ERROR`; a concurrent replay returns `409 SYNC_IN_PROGRESS`.

## Status language

These labels appear only in **Settings → Offline and sync**; no offline reminder is shown on other pages.

- **Offline** — host unreachable.
- **Pending** — local changes not yet sent.
- **Syncing** — changes being applied.
- **Synced** — server confirmed.
- **Conflict** — user action required.
- **Blocked** — authentication, validation, or quota issue requires attention.

## Limitations

- Background sync while the app is closed is not registered; reconnect and app-open replays are best-effort.
- Offline access requires a previously configured local cache and local unlock verifier.
- Server authorization remains mandatory; offline mode does not create server permissions.
- Large uploads can exceed browser quota; those failures are visible and do not delete queued work.
- Only allowlisted, previously cached query data is available offline.
