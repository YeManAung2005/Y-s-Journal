# Offline Synchronization

> **Status: designed; implementation begins in Phase 9.**

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

- Caches the application shell and static assets.
- Does not cache authenticated API responses in the HTTP cache.
- Uses Workbox through `vite-plugin-pwa` without a manifest install requirement.
- Shows an update prompt when a new app shell is available.
- Browser-only; no PWA installation is required.

## IndexedDB cache

- Dexie stores cached records and pending operations.
- Sensitive cached payloads are encrypted with AES-GCM.
- The local cache key is derived from the user password with PBKDF2-SHA-256 and held only in memory.
- Auto-lock clears the key from memory and locks the UI.
- Logout clears the local cache.
- Password changes invalidate old local caches.
- The local verifier is separate from server authentication and is used only for offline unlock on a trusted device.

## Queue model

Each queued operation includes:

- Client-generated operation ID.
- Idempotency key.
- HTTP method and path.
- Payload.
- Client-generated record ID for creates.
- Expected record version.
- Base record snapshot for conflict display.
- Timestamp.
- Dependency order.

Uploads within browser quota can be queued with generated file IDs. Quota failures are shown explicitly; data is never silently discarded.

## Sync protocol

1. Detect server reachability.
2. Replay queued operations in order.
3. Server validates authentication, ownership, validation rules, and expected version.
4. Server stores idempotent responses for retries.
5. Client marks an operation synced only after a successful server response.
6. On `409 Conflict`, pause dependent operations and store the conflict.
7. The user chooses: keep server, overwrite with mine, merge manually, or discard.
8. After resolution, replay stops or continues according to the user’s choice.

## Conflict rules

- Creates with the same idempotency key and record ID are idempotent.
- Updates require the version the client last saw.
- Deletes are soft deletes and versioned.
- A conflict is never resolved by an automatic last-write-wins policy.
- Conflicting data remains available for the user to compare.

## Status language

- **Offline** — host unreachable.
- **Pending** — local changes not yet sent.
- **Syncing** — changes being applied.
- **Synced** — server confirmed.
- **Conflict** — user action required.
- **Blocked** — authentication, validation, or quota issue requires attention.

## Limitations

- Automatic sync while the app is closed depends on browser background-sync support and is best-effort.
- Opening the app after reconnecting always triggers a sync attempt.
- Offline access requires a previously configured local cache and local unlock verifier.
- Server authorization remains mandatory; offline mode does not create server permissions.
