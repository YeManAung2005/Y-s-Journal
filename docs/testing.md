# Testing

## Current tests

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

Integration tests connect to `MONGODB_TEST_URI` (default `mongodb://127.0.0.1:27017/ys_journal_test`) and drop that database. They never touch `ys_journal`.

Commands:

```powershell
npm.cmd run test
npm.cmd run test:coverage
npm.cmd run lint
npm.cmd run build
npm.cmd run verify
```

## Required future coverage

### Unit

- Financial engine.
- Partial exits.
- Gross and net P&L.
- Fee allocation.
- Weighted average exit.
- Risk and R.
- Account balances.
- Drawdown.
- Profit factor edge cases.
- Streaks.
- Analytics filters.
- Learning streak and daily goals.
- Storage calculations.
- Date/time-zone boundaries.

### Integration

- API contracts.
- Authentication and authorization.
- Ownership isolation.
- Database operations.
- File uploads and file access.
- Audit history.
- Backup creation, verification, and restore.
- Idempotency and version conflicts.

### End-to-end

- First launch and onboarding.
- Owner account creation.
- Trade recording with partial exits.
- Trade editing.
- Learning records and goals.
- Daily journal.
- Calendar.
- Poster export.
- Backup and restore.
- Offline queue and conflict resolution.

### Security and privacy

- Unauthenticated access.
- Cross-owner access.
- CSRF.
- Session expiry.
- Rate limits.
- Path traversal.
- File authorization.
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
- Do not commit screenshots or generated reports.
- Tests must clean up their own records.
- Integration tests use a dedicated test database or dependency injection, never the live user database.

## Honesty rule

A test is reported as passing only after the command has actually run and passed. Failures and unfinished areas must be reported.
