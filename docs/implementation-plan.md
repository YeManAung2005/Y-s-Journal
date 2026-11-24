# Approved Implementation Plan

The project is implemented one approved phase at a time. Each phase ends with tests, lint, build, documentation, commit, and a review gate.

## Approved defaults

- Coding environment: OpenCode.
- Project path: `C:\Users\real_yezz\Documents\YsJournal`.
- Database: existing local MongoDB 9.0.4, database `ys_journal`.
- Network/system changes: performed only when the relevant phase requires them, with explicit prompts for elevated actions.
- Backup keys: random Backup Data Key wrapped by the user passphrase plus optional Windows DPAPI auto-unlock wrapper.
- Missing fees: strict. Net values and calculated balance are unavailable until fees are entered.
- Google Drive: OAuth client configured by the user during onboarding or later.
- GitHub: private `ys-journal` repository using authenticated GitHub CLI.
- Account: one editable default account with a `$0.00` starting balance and no sample trades.
- MongoDB: standalone; no multi-document transactions. Use idempotency, optimistic concurrency, staging, and safety backups.

## Phases

| Phase | Scope                                                                                |
| ----- | ------------------------------------------------------------------------------------ |
| 0     | Foundation, repository, documentation, app/API shell, health check, test tooling     |
| 1     | Owner onboarding, authentication, sessions, auto-lock, security logs, settings       |
| 2     | Financial engine, instruments, accounts, tags, sessions, checklist, reference data   |
| 3     | Trading journal core, partial exits, fees, risk, screenshots, emotions, reviews      |
| 4     | Trading analytics, filters, comparisons, equity curves, drawdown, streaks            |
| 5     | Learning records, categories, streaks, goals, milestones, attachments                |
| 6     | Personal Daily Journal, quick notes, search, reminders, privacy isolation            |
| 7     | Custom dashboard, widget library, calendar views                                     |
| 8     | Poster Studio, templates, live preview, PNG export                                   |
| 9     | Offline cache, encrypted IndexedDB, queued mutations, conflict resolution, auto-lock |
| 10    | Google Drive backups, encryption, verification, recovery key, safe restore           |
| 11    | Storage dashboard, limit warnings, trash, audit, exports, localization               |
| 12    | Security, privacy, accessibility, responsive, performance, browser hardening         |
| 13    | Windows installer, local HTTPS, firewall, service, startup, health, updates          |
| 14    | Final acceptance, full test pass, backup/restore drill, documentation, release tag   |

## Phase gate

1. Run tests.
2. Run lint.
3. Run production build.
4. Fix failures.
5. Verify functionality.
6. Update docs.
7. Show changes.
8. Commit to Git.
9. Wait for approval.

No phase may silently skip requirements, replace real functionality with mock data, change financial formulas, or add unresolved security risks.
