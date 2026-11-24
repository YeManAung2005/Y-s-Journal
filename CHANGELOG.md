# Changelog

All notable changes are documented here.

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

- Initialized the Git repository on `main`.
- Created the project at `C:\Users\real_yezz\Documents\YsJournal`.
- Installed GitHub CLI.
- Added the React 19 + Vite 8 + JavaScript + Tailwind 4 + shadcn/ui-style foundation.
- Added TanStack Router and TanStack Query.
- Added the Express 5 API with health endpoint and MongoDB ping.
- Added Pino structured logging and Helmet security headers.
- Added MongoDB connectivity verification script.
- Added Vitest, Supertest, React Testing Library, ESLint, and Prettier.
- Added the initial Overview page and responsive application shell.
- Added architecture, environment, schema, API, financial, security, backup, offline, testing, workflow, installation, Windows, user, and troubleshooting documentation.
- Added `.gitignore` protections for secrets, data, screenshots, backups, certificates, and build output.

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
