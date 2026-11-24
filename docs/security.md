# Security

> **Status: Phase 1 authentication and session protections are implemented.** Security logging, CSRF, rate limiting, and owner settings are active. File authorization, backups, and offline-security features arrive in later phases. Do not expose the development API to the LAN.

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

- Files stored outside Git.
- Generated storage keys, never client-supplied paths.
- Resolve and verify that every file path remains inside the configured storage root.
- Validate MIME type using file contents.
- Enforce size limits.
- Strip image metadata.
- Require authentication and ownership for every file read.
- Never expose unrestricted filesystem paths.
- Soft delete files with 30-day trash retention.

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

The journal is structurally isolated:

- Separate models, services, routes, and exports.
- Not imported by analytics, dashboard, poster, trading, or learning services.
- Poster data uses an explicit allowlist.
- Calendar journal indicators are off by default and neutral when enabled.
- Reminders contain no journal content.
- Audit diffs redact journal text.
- Automated privacy tests seed journal data and verify it cannot appear elsewhere.

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
